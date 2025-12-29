#!/usr/bin/env python3
"""
Campaign Worker - Polls for active campaigns and runs DM agent

This worker runs continuously, checking for active campaigns
and processing them with the DM agent IN PARALLEL.

Usage:
    python campaign_worker.py
    python campaign_worker.py --once    # Run one cycle only
    python campaign_worker.py --dry-run # Show what would be processed
"""

import os
import time
import argparse
import threading
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

try:
    from colorama import Fore, Style, init
    init(autoreset=True)
except ImportError:
    class Fore:
        CYAN = YELLOW = GREEN = RED = WHITE = MAGENTA = ""
    class Style:
        RESET_ALL = ""

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Supabase not installed. Run: pip install supabase")
    exit(1)

from dm_agent import InstagramDMAgent

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Worker settings
POLL_INTERVAL = int(os.getenv("WORKER_POLL_INTERVAL", "60"))  # seconds
DMS_PER_RUN = int(os.getenv("WORKER_DMS_PER_RUN", "10"))  # DMs per campaign run
COOLDOWN_MINUTES = int(os.getenv("WORKER_COOLDOWN_MINUTES", "30"))  # Minutes between runs
MAX_PARALLEL_CAMPAIGNS = int(os.getenv("MAX_PARALLEL_CAMPAIGNS", "5"))  # Max concurrent campaigns


class CampaignWorker:
    """
    Worker that polls for active campaigns and runs the DM agent.
    Campaigns are processed IN PARALLEL using separate threads.
    """
    
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.results = {}  # Thread-safe results tracking
        self.results_lock = threading.Lock()
        
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("Supabase credentials not configured")
        
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    def log(self, message: str, level: str = "info", campaign_name: str = None):
        """Colored logging with optional campaign prefix"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        colors = {
            "info": Fore.CYAN,
            "success": Fore.GREEN,
            "warning": Fore.YELLOW,
            "error": Fore.RED,
        }
        color = colors.get(level, Fore.WHITE)
        prefix = f"[{campaign_name}] " if campaign_name else ""
        print(f"{Fore.WHITE}[{timestamp}] {color}{prefix}{message}{Style.RESET_ALL}")
    
    def get_active_campaigns(self) -> List[Dict]:
        """
        Get all campaigns that are active and ready to run.
        A campaign is ready if:
        - status is 'active'
        - next_run_at is null or in the past
        - has assigned leads that haven't been messaged
        """
        self.log("🔍 Checking for active campaigns...", "info")
        
        try:
            # Get active campaigns
            result = self.supabase.table("campaigns").select(
                "*, users(id, email), instagram_accounts(id, instagram_username)"
            ).eq("status", "active").execute()
            
            campaigns = result.data or []
            ready_campaigns = []
            
            for campaign in campaigns:
                # Check if cooldown has passed
                next_run = campaign.get("next_run_at")
                if next_run:
                    try:
                        # Handle various timestamp formats from Supabase
                        next_run_str = next_run.replace("Z", "+00:00")
                        # Truncate fractional seconds to 6 digits max (Python limit)
                        if "." in next_run_str:
                            parts = next_run_str.split(".")
                            frac_and_tz = parts[1]
                            # Find where timezone starts (+ or -)
                            tz_start = max(frac_and_tz.find("+"), frac_and_tz.find("-"))
                            if tz_start > 0:
                                frac = frac_and_tz[:min(tz_start, 6)]
                                tz = frac_and_tz[tz_start:]
                                next_run_str = f"{parts[0]}.{frac}{tz}"
                        next_run_dt = datetime.fromisoformat(next_run_str)
                        # Compare in UTC to avoid timezone issues
                        now_utc = datetime.now(timezone.utc)
                        if next_run_dt > now_utc:
                            self.log(f"   ⏳ Campaign '{campaign['name']}' in cooldown until {next_run}", "info")
                            continue
                    except Exception as parse_err:
                        self.log(f"   ⚠️ Could not parse next_run_at '{next_run}': {parse_err}", "warning")
                
                # Check if campaign has pending leads
                leads_result = self.supabase.table("leads").select(
                    "id", count="exact"
                ).eq("campaign_id", campaign["id"]).eq("dm_sent", False).execute()
                
                pending_leads = leads_result.count or 0
                
                if pending_leads == 0:
                    self.log(f"   📭 Campaign '{campaign['name']}' has no pending leads", "info")
                    # Mark as completed if no leads left
                    self.supabase.table("campaigns").update({
                        "status": "completed"
                    }).eq("id", campaign["id"]).execute()
                    continue
                
                campaign["pending_leads"] = pending_leads
                ready_campaigns.append(campaign)
                self.log(f"   ✅ Campaign '{campaign['name']}' ready ({pending_leads} leads)", "success")
            
            return ready_campaigns
        
        except Exception as e:
            self.log(f"❌ Error fetching campaigns: {e}", "error")
            return []
    
    def process_campaign(self, campaign: Dict) -> bool:
        """
        Process a single campaign - run DM agent for it.
        This runs in its own thread.
        Returns True if successful.
        """
        campaign_id = campaign["id"]
        campaign_name = campaign["name"]
        user_id = campaign["user_id"]
        template = campaign.get("message_template") or "default"
        dms_per_session = campaign.get("dms_per_session") or DMS_PER_RUN
        
        self.log(f"🚀 Starting campaign processing", "info", campaign_name)
        self.log(f"   User: {campaign.get('users', {}).get('email', 'Unknown')}", "info", campaign_name)
        self.log(f"   Instagram: @{campaign.get('instagram_accounts', {}).get('instagram_username', 'Unknown')}", "info", campaign_name)
        self.log(f"   Template: {template}", "info", campaign_name)
        self.log(f"   DMs per session: {dms_per_session}", "info", campaign_name)
        self.log(f"   Pending leads: {campaign.get('pending_leads', 0)}", "info", campaign_name)
        
        if self.dry_run:
            self.log("   [DRY RUN] Would process this campaign", "warning", campaign_name)
            return True
        
        try:
            # Update campaign to show it's running (use UTC)
            self.supabase.table("campaigns").update({
                "last_run_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", campaign_id).execute()
            
            # Create and run DM agent for this campaign
            agent = InstagramDMAgent(
                user_id=user_id,
                headless=True,  # Run in headless mode
                template=template if template != "ai" else "ai",
                limit=dms_per_session,  # Use campaign's DMs per session setting
                campaign_id=campaign_id  # Pass campaign filter
            )
            
            # Run the agent
            agent.run()
            
            # Set next run time (cooldown) - use UTC for consistency
            next_run = datetime.now(timezone.utc) + timedelta(minutes=COOLDOWN_MINUTES)
            self.supabase.table("campaigns").update({
                "next_run_at": next_run.isoformat()
            }).eq("id", campaign_id).execute()
            
            self.log(f"✅ Campaign completed. Next run at {next_run}", "success", campaign_name)
            
            # Record result
            with self.results_lock:
                self.results[campaign_id] = {"success": True, "name": campaign_name}
            
            return True
        
        except Exception as e:
            self.log(f"❌ Error: {e}", "error", campaign_name)
            
            # Set retry time (shorter cooldown for failed campaigns)
            try:
                next_run = datetime.now(timezone.utc) + timedelta(minutes=5)
                self.supabase.table("campaigns").update({
                    "next_run_at": next_run.isoformat()
                }).eq("id", campaign_id).execute()
            except:
                pass
            
            # Record result
            with self.results_lock:
                self.results[campaign_id] = {"success": False, "name": campaign_name, "error": str(e)}
            
            return False
    
    def run_once(self):
        """Run one cycle of campaign processing - IN PARALLEL."""
        self.log("\n" + "=" * 60, "info")
        self.log("🔄 Campaign Worker - Running cycle (PARALLEL MODE)", "info")
        self.log("=" * 60, "info")
        
        campaigns = self.get_active_campaigns()
        
        if not campaigns:
            self.log("📭 No campaigns ready to process", "info")
            return
        
        # Limit concurrent campaigns
        campaigns_to_process = campaigns[:MAX_PARALLEL_CAMPAIGNS]
        if len(campaigns) > MAX_PARALLEL_CAMPAIGNS:
            self.log(f"⚠️ Limiting to {MAX_PARALLEL_CAMPAIGNS} campaigns (have {len(campaigns)} ready)", "warning")
        
        self.log(f"\n📋 Processing {len(campaigns_to_process)} campaigns IN PARALLEL", "info")
        
        # Reset results
        self.results = {}
        
        # Create threads for each campaign
        threads = []
        for campaign in campaigns_to_process:
            thread = threading.Thread(
                target=self.process_campaign,
                args=(campaign,),
                name=f"Campaign-{campaign['name'][:20]}"
            )
            threads.append(thread)
            self.log(f"   🧵 Created thread for '{campaign['name']}'", "info")
        
        # Start all threads
        self.log("\n🚀 Starting all campaigns...", "info")
        for thread in threads:
            thread.start()
            time.sleep(2)  # Small stagger to avoid resource contention
        
        # Wait for all threads to complete
        self.log("⏳ Waiting for all campaigns to complete...", "info")
        for thread in threads:
            thread.join()
        
        # Summarize results
        successful = sum(1 for r in self.results.values() if r.get("success"))
        failed = len(self.results) - successful
        
        self.log("\n" + "=" * 60, "info")
        self.log("📊 PARALLEL PROCESSING COMPLETE", "info")
        self.log(f"   ✅ Successful: {successful}", "success" if successful > 0 else "info")
        self.log(f"   ❌ Failed: {failed}", "error" if failed > 0 else "info")
        
        for campaign_id, result in self.results.items():
            status = "✅" if result["success"] else "❌"
            error = f" - {result.get('error', '')[:50]}" if result.get("error") else ""
            self.log(f"   {status} {result['name']}{error}", "info")
        
        self.log("=" * 60, "info")
    
    def run_forever(self):
        """Run continuously, polling for campaigns."""
        self.log("\n" + "=" * 60, "info")
        self.log("🚀 Campaign Worker Started (PARALLEL MODE)", "info")
        self.log(f"   Poll interval: {POLL_INTERVAL}s", "info")
        self.log(f"   DMs per run: {DMS_PER_RUN}", "info")
        self.log(f"   Cooldown: {COOLDOWN_MINUTES} minutes", "info")
        self.log(f"   Max parallel: {MAX_PARALLEL_CAMPAIGNS}", "info")
        self.log("=" * 60, "info")
        
        while True:
            try:
                self.run_once()
            except KeyboardInterrupt:
                self.log("\n⛔ Worker stopped by user", "warning")
                break
            except Exception as e:
                self.log(f"❌ Worker error: {e}", "error")
            
            self.log(f"\n💤 Sleeping {POLL_INTERVAL}s until next check...", "info")
            time.sleep(POLL_INTERVAL)


def main():
    parser = argparse.ArgumentParser(description="Campaign Worker")
    parser.add_argument("--once", action="store_true",
                        help="Run one cycle only")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be processed without actually running")
    
    args = parser.parse_args()
    
    worker = CampaignWorker(dry_run=args.dry_run)
    
    if args.once:
        worker.run_once()
    else:
        worker.run_forever()


if __name__ == "__main__":
    main()
