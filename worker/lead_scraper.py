#!/usr/bin/env python3
"""
Instagram Lead Scraper
Scrapes post likers using PhantomBuster and stores them in Supabase.
"""

import os
import sys
import json
import time
import requests
import logging
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
PHANTOMBUSTER_API_KEY = os.getenv("PHANTOMBUSTER_API_KEY")
PHANTOMBUSTER_AGENT_ID = os.getenv("PHANTOMBUSTER_AGENT_ID")

# PhantomBuster API endpoints
PB_BASE_URL = "https://api.phantombuster.com/api/v2"
PB_LAUNCH_URL = f"{PB_BASE_URL}/agents/launch"
PB_CONTAINER_URL = f"{PB_BASE_URL}/containers/fetch"
PB_OUTPUT_URL = f"{PB_BASE_URL}/agents/fetch-output"

# Timing
POLL_INTERVAL = 10  # seconds between status checks
MAX_WAIT_TIME = 300  # 5 minutes max wait per scrape
DELAY_BETWEEN_POSTS = 5  # seconds between scraping different posts

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class ScrapeResult:
    """Result of a single post scrape."""
    post_url: str
    success: bool
    leads_count: int
    error: Optional[str] = None


class InstagramLeadScraper:
    """
    Scrapes Instagram post likers using PhantomBuster.
    """
    
    def __init__(
        self,
        user_id: str,
        campaign_id: Optional[str] = None,
        max_likers_per_post: int = 100,
        session_cookie: Optional[str] = None
    ):
        self.user_id = user_id
        self.campaign_id = campaign_id
        self.max_likers_per_post = max_likers_per_post
        self.session_cookie = session_cookie
        
        # Validate config
        if not PHANTOMBUSTER_API_KEY:
            raise ValueError("PHANTOMBUSTER_API_KEY not set")
        if not PHANTOMBUSTER_AGENT_ID:
            raise ValueError("PHANTOMBUSTER_AGENT_ID not set")
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("Supabase credentials not set")
        
        self.headers = {
            "X-Phantombuster-Key": PHANTOMBUSTER_API_KEY,
            "Content-Type": "application/json"
        }
        
        # Initialize Supabase client
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # =========================================================================
    # DATABASE METHODS
    # =========================================================================
    
    def store_leads(self, leads: List[Dict], source_post_url: str) -> int:
        """
        Store scraped leads in database.
        Returns number of new leads inserted.
        """
        if not leads:
            return 0
        
        inserted_count = 0
        
        for lead in leads:
            # Extract username from profile URL or use username field
            username = lead.get('username')
            if not username and lead.get('profileUrl'):
                # Extract from URL like https://www.instagram.com/username/
                parts = lead.get('profileUrl', '').rstrip('/').split('/')
                username = parts[-1] if parts else None
            
            if not username:
                continue
            
            lead_data = {
                "user_id": self.user_id,
                "campaign_id": self.campaign_id,
                "instagram_username": username,
                "full_name": lead.get('fullName') or lead.get('name'),
                "profile_url": lead.get('profileUrl'),
                "bio": lead.get('bio'),
                "followers_count": lead.get('followersCount'),
                "is_verified": lead.get('verified', False),
                "source_post_url": source_post_url,
            }
            
            try:
                # Upsert - insert or ignore if exists
                result = self.supabase.table("leads").upsert(
                    lead_data,
                    on_conflict="user_id,instagram_username"
                ).execute()
                
                if result.data:
                    inserted_count += 1
            except Exception as e:
                logger.warning(f"Failed to insert lead {username}: {e}")
        
        logger.info(f"   💾 Stored {inserted_count} new leads")
        return inserted_count

    # =========================================================================
    # PHANTOMBUSTER API METHODS
    # =========================================================================
    
    def launch_phantom(self, post_url: str) -> Optional[str]:
        """
        Launch PhantomBuster agent to scrape a post.
        Returns container_id if successful.
        """
        argument = {
            "spreadsheetUrl": post_url,
            "numberOfLikersPerPost": self.max_likers_per_post,
        }
        
        # Add session cookie if available for authenticated scraping
        if self.session_cookie:
            argument["sessionCookie"] = self.session_cookie
        
        payload = {
            "id": PHANTOMBUSTER_AGENT_ID,
            "argument": argument
        }
        
        try:
            response = requests.post(
                PB_LAUNCH_URL,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                container_id = data.get("containerId")
                logger.info(f"   🚀 Launched phantom, container: {container_id}")
                return container_id
            elif response.status_code == 429:
                logger.error("   ❌ PhantomBuster rate limit (agent already running)")
                return None
            else:
                logger.error(f"   ❌ Launch failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"   ❌ Launch exception: {e}")
            return None

    def wait_for_completion(self, container_id: str) -> bool:
        """
        Poll PhantomBuster until scrape is complete.
        Returns True if successful.
        """
        start_time = time.time()
        
        while time.time() - start_time < MAX_WAIT_TIME:
            try:
                response = requests.get(
                    f"{PB_CONTAINER_URL}?id={container_id}",
                    headers=self.headers,
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status")
                    
                    if status == "finished":
                        logger.info("   ✅ Scrape completed!")
                        return True
                    elif status == "error":
                        logger.error(f"   ❌ Scrape failed: {data.get('error')}")
                        return False
                    else:
                        # Still running
                        elapsed = int(time.time() - start_time)
                        logger.info(f"   ⏳ Scraping... ({elapsed}s elapsed)")
                        time.sleep(POLL_INTERVAL)
                else:
                    logger.error(f"   ❌ Status check failed: {response.status_code}")
                    time.sleep(POLL_INTERVAL)
                    
            except Exception as e:
                logger.error(f"   ❌ Status check exception: {e}")
                time.sleep(POLL_INTERVAL)
        
        logger.error("   ❌ Scrape timed out")
        return False

    def fetch_results(self) -> List[Dict]:
        """
        Fetch scrape results from PhantomBuster.
        Returns list of lead dictionaries.
        """
        try:
            response = requests.get(
                f"{PB_OUTPUT_URL}?id={PHANTOMBUSTER_AGENT_ID}",
                headers=self.headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                leads = data.get("resultObject", [])
                
                if isinstance(leads, list):
                    logger.info(f"   📋 Fetched {len(leads)} leads from PhantomBuster")
                    return leads
                else:
                    logger.warning("   ⚠️ Unexpected result format")
                    return []
            else:
                logger.error(f"   ❌ Fetch failed: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"   ❌ Fetch exception: {e}")
            return []

    # =========================================================================
    # MAIN SCRAPING METHODS
    # =========================================================================
    
    def scrape_single_post(self, post_url: str) -> ScrapeResult:
        """
        Scrape likers from a single Instagram post.
        """
        logger.info(f"\n📌 Scraping post: {post_url}")
        
        # Launch PhantomBuster
        container_id = self.launch_phantom(post_url)
        if not container_id:
            return ScrapeResult(post_url, False, 0, "Failed to launch phantom")
        
        # Wait for completion
        success = self.wait_for_completion(container_id)
        if not success:
            return ScrapeResult(post_url, False, 0, "Scrape timed out or failed")
        
        # Fetch results
        leads = self.fetch_results()
        if not leads:
            return ScrapeResult(post_url, True, 0, "No leads found")
        
        # Store in database
        stored_count = self.store_leads(leads, post_url)
        
        return ScrapeResult(post_url, True, stored_count)

    def scrape_multiple_posts(self, post_urls: List[str]) -> List[ScrapeResult]:
        """
        Scrape likers from multiple posts SEQUENTIALLY.
        
        IMPORTANT: PhantomBuster only allows 1 agent execution at a time.
        We must wait for each scrape to complete before starting the next.
        """
        logger.info("=" * 60)
        logger.info(f"🚀 Starting lead scrape for {len(post_urls)} posts")
        logger.info(f"   User ID: {self.user_id}")
        logger.info(f"   Campaign ID: {self.campaign_id}")
        logger.info(f"   Max likers per post: {self.max_likers_per_post}")
        logger.info("=" * 60)
        
        results = []
        total_leads = 0
        
        for i, post_url in enumerate(post_urls, 1):
            logger.info(f"\n[{i}/{len(post_urls)}] Processing post...")
            
            result = self.scrape_single_post(post_url)
            results.append(result)
            
            if result.success:
                total_leads += result.leads_count
            
            # Wait between posts (avoid rate limiting)
            if i < len(post_urls):
                logger.info(f"   ⏳ Waiting {DELAY_BETWEEN_POSTS}s before next post...")
                time.sleep(DELAY_BETWEEN_POSTS)
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("🎉 SCRAPING COMPLETE")
        logger.info(f"   Posts processed: {len(post_urls)}")
        logger.info(f"   Successful: {sum(1 for r in results if r.success)}")
        logger.info(f"   Failed: {sum(1 for r in results if not r.success)}")
        logger.info(f"   Total new leads: {total_leads}")
        logger.info("=" * 60)
        
        return results


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Instagram Lead Scraper")
    parser.add_argument('--user-id', '-u', type=str, required=True,
                        help='User ID to associate leads with')
    parser.add_argument('--campaign-id', '-c', type=str,
                        help='Campaign ID (optional)')
    parser.add_argument('--urls', '-p', type=str, nargs='+', required=True,
                        help='Instagram post URLs to scrape')
    parser.add_argument('--max-likers', '-m', type=int, default=100,
                        help='Max likers to scrape per post (default: 100)')
    parser.add_argument('--session-cookie', '-s', type=str,
                        help='Instagram session cookie for authenticated scraping')
    
    args = parser.parse_args()
    
    scraper = InstagramLeadScraper(
        user_id=args.user_id,
        campaign_id=args.campaign_id,
        max_likers_per_post=args.max_likers,
        session_cookie=args.session_cookie
    )
    
    scraper.scrape_multiple_posts(args.urls)


if __name__ == "__main__":
    main()




