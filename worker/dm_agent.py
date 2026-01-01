#!/usr/bin/env python3
"""
Instagram DM Agent - Supabase + Steel.dev Session Based

Sends personalized DMs to leads stored in Supabase.
Uses captured Instagram sessions from Steel.dev (no login required).

Usage:
    python dm_agent.py --user-id <uuid> --limit 10
    python dm_agent.py --user-id <uuid> --template ai
    python dm_agent.py --user-id <uuid> --test
    python dm_agent.py --user-id <uuid> --stats
"""

import json
import random
import time
import argparse
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
from dotenv import load_dotenv

load_dotenv()

# Color output
try:
    from colorama import Fore, Style, init
    init(autoreset=True)
except ImportError:
    class Fore:
        CYAN = YELLOW = GREEN = RED = WHITE = MAGENTA = ""
    class Style:
        RESET_ALL = ""

# Playwright
try:
    from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright
except ImportError:
    print("❌ Playwright not installed. Run: pip install playwright && playwright install chromium")
    exit(1)

# Supabase
try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Supabase not installed. Run: pip install supabase")
    exit(1)

# Anthropic for AI messages
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Rate Limiting
DELAY_BETWEEN_DMS = int(os.getenv("DELAY_BETWEEN_DMS", "60"))
DELAY_BETWEEN_BATCHES = int(os.getenv("DELAY_BETWEEN_BATCHES", "300"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "10"))
MAX_DMS_PER_DAY = int(os.getenv("MAX_DMS_PER_DAY", "50"))

# Browser Settings
HEADLESS = os.getenv("HEADLESS", "false").lower() == "true"
SLOW_MO = int(os.getenv("SLOW_MO", "100"))

# Instagram URLs
INSTAGRAM_BASE_URL = "https://www.instagram.com"
INSTAGRAM_DM_URL = f"{INSTAGRAM_BASE_URL}/direct/inbox/"

# ============================================================
# MESSAGE TEMPLATES
# ============================================================
TEMPLATES = {
    "default": """Hey {{fullName}}!

I noticed you engaged with some content I follow. 

Quick question - are you open to growing your Instagram faster with AI-powered automation?

We built something that sends personalized DMs at scale.

Reply "yes" if interested!""",

    "short": """{{fullName}} –

Built an Instagram growth tool.
Automated DMs. Personalized. Scales infinitely.

Want to see it?""",

    "bold": """{{fullName}} –

We send 1,000+ personalized Instagram DMs per day.
Zero manual work.

If you want in, reply "show me".""",

    "ai": "AI_GENERATED",
}

# ============================================================
# AI MESSAGE GENERATION
# ============================================================
AI_SYSTEM_PROMPT = """You are an expert cold DM copywriter. Write short, personalized Instagram DMs that get replies.

Rules:
1. Keep it under 80 words - Instagram DMs should be brief
2. Start with their name
3. Be conversational and friendly
4. Pitch an Instagram growth/automation tool
5. End with a simple CTA
6. NO hashtags, minimal emojis (1-2 max)
7. Sound human, not robotic

Output ONLY the message text. No explanations."""


def generate_ai_message(lead_data: Dict) -> Optional[str]:
    """Generate a personalized DM using Claude AI"""
    if not ANTHROPIC_AVAILABLE or not ANTHROPIC_API_KEY:
        return None
    
    username = lead_data.get("username", "")
    full_name = lead_data.get("full_name", "")
    
    user_prompt = f"""Write a personalized cold DM for this Instagram lead:
Username: @{username}
Name: {full_name if full_name else "Unknown"}

Write a compelling, personalized DM that will get them to reply."""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            system=AI_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}]
        )
        return response.content[0].text.strip()
    except Exception as e:
        print(f"{Fore.RED}❌ AI generation error: {e}{Style.RESET_ALL}")
        return None


def clean_username(username: str) -> str:
    """Clean username - remove @ and whitespace"""
    if not username:
        return ""
    return username.strip().replace("@", "").strip()


def clean_fullname(fullname: str, username: str) -> str:
    """Clean and fallback for fullName."""
    if not fullname or not fullname.strip():
        return "Hey there"
    fullname = fullname.strip()
    if fullname.lower() == username.lower():
        return "Hey there"
    if len(fullname) < 2:
        return "Hey there"
    return fullname


def personalize_message(template: str, username: str, fullname: str) -> str:
    """Replace template variables with actual values."""
    message = template
    username = clean_username(username)
    fullname = clean_fullname(fullname, username)
    message = message.replace("{{fullName}}", fullname)
    message = message.replace("{{username}}", username)
    return message.strip()


class InstagramDMAgent:
    """
    Playwright-based Instagram DM automation using Steel.dev captured sessions.
    
    Uses the Inbox Compose Method which works for both public and private accounts.
    """
    
    def __init__(
        self,
        user_id: str,
        headless: bool = None,
        template: str = "default",
        limit: int = None,
        campaign_id: str = None
    ):
        self.user_id = user_id
        self.campaign_id = campaign_id  # Optional: filter leads by campaign
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.dms_sent_today = 0
        self.headless = headless if headless is not None else HEADLESS
        self.template_name = template
        self.template = TEMPLATES.get(template, TEMPLATES["default"])
        self.limit = limit or MAX_DMS_PER_DAY
        
        # Initialize Supabase
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("Supabase credentials not configured")
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    def log(self, message: str, level: str = "info"):
        """Colored logging"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        colors = {
            "info": Fore.CYAN,
            "success": Fore.GREEN,
            "warning": Fore.YELLOW,
            "error": Fore.RED,
        }
        color = colors.get(level, Fore.WHITE)
        print(f"{Fore.WHITE}[{timestamp}] {color}{message}{Style.RESET_ALL}")
    
    def random_delay(self, min_seconds: float, max_seconds: float):
        """Add random delay to simulate human behavior"""
        delay = random.uniform(min_seconds, max_seconds)
        self.log(f"⏳ Waiting {delay:.1f}s...", "info")
        time.sleep(delay)
    
    def get_instagram_session(self) -> Optional[Dict]:
        """Get the active Instagram session for this user from Supabase"""
        self.log("🔑 Loading Instagram session from database...", "info")
        
        try:
            # Get user's Instagram account
            accounts = self.supabase.table("instagram_accounts").select("id").eq("user_id", self.user_id).eq("status", "active").execute()
            
            if not accounts.data:
                self.log("❌ No active Instagram account found", "error")
                return None
            
            account_id = accounts.data[0]["id"]
            
            # Get session data
            sessions = self.supabase.table("instagram_sessions").select("*").eq("instagram_account_id", account_id).eq("status", "active").execute()
            
            if not sessions.data:
                self.log("❌ No active session found. Please reconnect Instagram.", "error")
                return None
            
            session = sessions.data[0]
            self.log(f"✅ Loaded session for account", "success")
            return session
        
        except Exception as e:
            self.log(f"❌ Error loading session: {e}", "error")
            return None
    
    def start_browser(self, session_data: Dict) -> bool:
        """Initialize Playwright browser with captured session"""
        self.log("🚀 Starting browser with captured session...", "info")
        
        try:
            self.playwright = sync_playwright().start()
            
            self.browser = self.playwright.chromium.launch(
                headless=self.headless,
                slow_mo=SLOW_MO,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                    "--window-size=1920,1080",
                ]
            )
            
            # Use the captured session state
            storage_state = session_data.get("session_data", {})
            
            if storage_state:
                self.context = self.browser.new_context(
                    storage_state=storage_state,
                    viewport={"width": 1920, "height": 1080},
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                )
            else:
                self.log("⚠️ No storage state in session, creating fresh context", "warning")
                self.context = self.browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                )
            
            self.page = self.context.new_page()
            
            # Block images for faster loading
            self.page.route("**/*.{png,jpg,jpeg,gif,webp}", lambda route: route.abort())
            
            self.log("✅ Browser started", "success")
            return True
        
        except Exception as e:
            self.log(f"❌ Browser start error: {e}", "error")
            return False
    
    def dismiss_popups(self):
        """Dismiss any Instagram popups"""
        popup_buttons = [
            'button:has-text("Not Now")',
            'button:has-text("Turn On")',
            '[role="dialog"] button:has-text("Not Now")',
            '[role="dialog"] button:has-text("Cancel")',
        ]
        
        for selector in popup_buttons:
            try:
                btn = self.page.locator(selector).first
                if btn.count() > 0 and btn.is_visible(timeout=1000):
                    btn.click()
                    self.log("🔔 Dismissed popup", "info")
                    time.sleep(0.5)
                    return True
            except:
                continue
        return False
    
    def is_logged_in(self) -> bool:
        """Check if session is still valid"""
        try:
            self.page.goto(INSTAGRAM_BASE_URL, wait_until="domcontentloaded", timeout=60000)
            self.random_delay(3, 5)
            
            self.dismiss_popups()
            
            home_icon = self.page.locator('svg[aria-label="Home"]').count() > 0
            inbox_icon = self.page.locator('svg[aria-label="Messenger"]').count() > 0
            profile_pic = self.page.locator('img[alt*="profile picture"]').count() > 0
            
            is_logged = home_icon or inbox_icon or profile_pic
            
            if is_logged:
                self.log("✅ Session is valid!", "success")
            else:
                self.log("❌ Session expired - marking account for re-auth", "error")
                # Mark account as needing re-authentication
                try:
                    self.supabase.table("instagram_accounts").update({
                        "status": "needs_reauth"
                    }).eq("user_id", self.user_id).execute()
                except:
                    pass
            
            return is_logged
        except Exception as e:
            self.log(f"Error checking login: {e}", "error")
            return False
    
    def return_to_inbox(self):
        """Safely return to inbox on error"""
        try:
            self.log("🔄 Returning to inbox...", "info")
            self.page.goto(INSTAGRAM_DM_URL, wait_until="domcontentloaded", timeout=30000)
            self.random_delay(1, 2)
            self.dismiss_popups()
        except Exception as e:
            self.log(f"⚠️ Could not return to inbox: {e}", "warning")
    
    def send_dm(self, username: str, message: str) -> dict:
        """
        Send a DM using the Inbox Compose Method.
        Returns dict with 'success', 'error' keys.
        """
        self.log(f"📨 Sending DM to @{username}...", "info")
        result = {"success": False, "error": None}
        
        try:
            # Step 1: Go to inbox
            self.log("📥 Going to inbox...", "info")
            self.page.goto(INSTAGRAM_DM_URL, wait_until="domcontentloaded", timeout=60000)
            self.random_delay(2, 3)
            self.dismiss_popups()
            
            # Step 2: Click compose icon
            self.log("✏️ Looking for compose button...", "info")
            compose_selectors = [
                'svg[aria-label="New message"]',
                '[aria-label="New message"]',
                'svg[aria-label="New Message"]',
                '[aria-label="New Message"]',
            ]
            
            compose_clicked = False
            for selector in compose_selectors:
                try:
                    btn = self.page.locator(selector).first
                    if btn.count() > 0 and btn.is_visible():
                        btn.click()
                        compose_clicked = True
                        self.random_delay(1.5, 2.5)
                        break
                except:
                    continue
            
            if not compose_clicked:
                result["error"] = "Could not find compose button"
                self.log(f"❌ {result['error']}", "error")
                self.return_to_inbox()
                return result
            
            # Step 3: Search for username
            self.log(f"🔍 Searching for @{username}...", "info")
            self.random_delay(1, 2)
            
            search_selectors = [
                'input[placeholder="Search..."]',
                'input[name="queryBox"]',
                'input[aria-label="Search"]',
                '[role="dialog"] input',
            ]
            
            search_input = None
            for selector in search_selectors:
                try:
                    inp = self.page.locator(selector).first
                    if inp.count() > 0 and inp.is_visible():
                        search_input = inp
                        break
                except:
                    continue
            
            if not search_input:
                result["error"] = "Could not find search input"
                self.log(f"❌ {result['error']}", "error")
                self.return_to_inbox()
                return result
            
            search_input.click()
            self.random_delay(0.3, 0.6)
            search_input.fill(username)
            self.random_delay(2, 3)
            
            # Step 4: Click first result
            self.log(f"👤 Waiting for search results...", "info")
            self.random_delay(2, 2.5)
            
            try:
                dialog = self.page.locator('[role="dialog"]')
                dialog.wait_for(state="visible", timeout=3000)
                box = dialog.bounding_box()
                if box:
                    click_x = box['x'] + (box['width'] / 2)
                    click_y = box['y'] + 190
                    self.page.mouse.click(click_x, click_y)
                    self.log("✅ Clicked first result!", "success")
                else:
                    result["error"] = "Could not get dialog bounding box"
                    self.return_to_inbox()
                    return result
            except Exception as e:
                result["error"] = f"Could not click result: {e}"
                self.log(f"❌ {result['error']}", "error")
                self.return_to_inbox()
                return result
            
            self.random_delay(1.5, 2)
            
            # Step 5: Click Chat button
            self.log(f"💬 Clicking Chat button...", "info")
            
            chat_clicked = False
            try:
                chat_btn = self.page.get_by_role("button", name="Chat", exact=True)
                chat_btn.wait_for(state="visible", timeout=3000)
                
                is_disabled = chat_btn.get_attribute("aria-disabled")
                if is_disabled == "true":
                    result["error"] = "Chat button disabled - user not selected"
                    self.return_to_inbox()
                    return result
                
                chat_btn.click()
                chat_clicked = True
                self.log("✅ Clicked Chat button!", "success")
            except:
                pass
            
            if not chat_clicked:
                try:
                    chat_btn = self.page.locator('div[role="button"]:text-is("Chat")')
                    if chat_btn.count() > 0:
                        chat_btn.first.click()
                        chat_clicked = True
                except:
                    pass
            
            if not chat_clicked:
                result["error"] = "Could not click Chat button"
                self.return_to_inbox()
                return result
            
            # Wait for chat to open
            self.log("⏳ Waiting for chat to open...", "info")
            try:
                self.page.wait_for_url("**/direct/t/**", timeout=10000)
            except:
                pass
            
            self.random_delay(1.5, 2)
            
            # Step 6: Find message input
            self.log("✏️ Finding message input...", "info")
            
            message_input = None
            try:
                all_inputs = self.page.locator('div[aria-label="Message"]').all()
                for inp in all_inputs:
                    try:
                        box = inp.bounding_box()
                        if box and box['x'] > 350:  # Past sidebar
                            message_input = inp
                            inp.click()
                            self.random_delay(0.3, 0.5)
                            break
                    except:
                        continue
            except:
                pass
            
            if not message_input or message_input.count() == 0:
                result["error"] = "Message input not found"
                self.return_to_inbox()
                return result
            
            # Step 7: Type and send message
            self.log("✏️ Typing message...", "info")
            
            try:
                message_input.focus()
            except:
                message_input.click()
            
            self.random_delay(0.3, 0.5)
            message_input.fill(message)
            self.random_delay(1, 1.5)
            
            self.log("📤 Sending with Enter key...", "info")
            message_input.press("Enter")
            
            self.random_delay(2, 3)
            
            self.log(f"✅ DM sent to @{username}", "success")
            self.dms_sent_today += 1
            result["success"] = True
        
        except Exception as e:
            result["error"] = str(e)
            self.log(f"❌ Error sending DM to @{username}: {e}", "error")
            self.return_to_inbox()
        
        return result
    
    def load_leads(self) -> List[Dict]:
        """Load uncontacted leads from Supabase"""
        self.log("📊 Loading leads from database...", "info")
        
        try:
            # Build query for leads that haven't been messaged
            query = self.supabase.table("leads").select("*").eq("user_id", self.user_id).eq("dm_sent", False)
            
            # Filter by campaign if specified
            if self.campaign_id:
                query = query.eq("campaign_id", self.campaign_id)
                self.log(f"   Filtering by campaign: {self.campaign_id[:8]}...", "info")
            
            result = query.limit(self.limit).execute()
            
            leads = []
            use_ai = self.template_name == "ai"
            
            if use_ai:
                self.log("🤖 Using AI-powered message generation...", "info")
            
            for row in result.data:
                username = row.get("instagram_username", "")
                full_name = row.get("full_name", "")
                
                lead_data = {
                    "id": row.get("id"),
                    "username": username,
                    "full_name": full_name,
                }
                
                if use_ai:
                    self.log(f"🤖 Generating AI message for @{username}...", "info")
                    message = generate_ai_message(lead_data)
                    if not message:
                        message = personalize_message(TEMPLATES["default"], username, full_name)
                else:
                    message = personalize_message(self.template, username, full_name)
                
                leads.append({
                    "id": row.get("id"),
                    "username": username,
                    "full_name": full_name,
                    "message": message,
                })
            
            self.log(f"📋 Loaded {len(leads)} leads to message", "info")
            return leads
        
        except Exception as e:
            self.log(f"❌ Database error: {e}", "error")
            return []
    
    def update_lead_status(self, lead_id: str, message: str, success: bool, error: str = None):
        """Update lead status in database - always mark as sent to skip on future runs"""
        try:
            # Always mark as dm_sent=True so we don't retry failed leads forever
            update_data = {
                "dm_sent": True,  # Mark as processed regardless of success/failure
                "dm_sent_at": datetime.now().isoformat() if success else None,
            }
            
            self.supabase.table("leads").update(update_data).eq("id", lead_id).execute()
            
            # Also log to dm_logs table and update campaign stats
            if success:
                # Get instagram account id
                accounts = self.supabase.table("instagram_accounts").select("id").eq("user_id", self.user_id).eq("status", "active").limit(1).execute()
                
                if accounts.data:
                    log_data = {
                        "lead_id": lead_id,
                        "instagram_account_id": accounts.data[0]["id"],
                        "campaign_id": self.campaign_id,
                        "message_sent": message,
                        "status": "sent" if success else "failed",
                        "error_message": error,
                    }
                    self.supabase.table("dm_logs").insert(log_data).execute()
                
                # Update campaign DM count
                if self.campaign_id:
                    self.supabase.rpc("increment_campaign_dms", {
                        "campaign_id": self.campaign_id
                    }).execute()
            
            status_emoji = "✅" if success else "❌"
            self.log(f"💾 {status_emoji} Updated lead in database", "info")
        
        except Exception as e:
            self.log(f"⚠️ Database update error: {e}", "warning")
    
    def get_stats(self) -> Dict:
        """Get lead statistics"""
        try:
            # Build base query
            base_query = self.supabase.table("leads").select("id", count="exact").eq("user_id", self.user_id)
            
            # Filter by campaign if specified
            if self.campaign_id:
                total_query = base_query.eq("campaign_id", self.campaign_id)
                sent_query = self.supabase.table("leads").select("id", count="exact").eq("user_id", self.user_id).eq("campaign_id", self.campaign_id).eq("dm_sent", True)
            else:
                total_query = base_query
                sent_query = self.supabase.table("leads").select("id", count="exact").eq("user_id", self.user_id).eq("dm_sent", True)
            
            total = total_query.execute()
            sent = sent_query.execute()
            
            return {
                "total": total.count or 0,
                "sent": sent.count or 0,
                "pending": (total.count or 0) - (sent.count or 0),
            }
        except Exception as e:
            self.log(f"⚠️ Could not fetch stats: {e}", "warning")
            return {"total": 0, "sent": 0, "pending": 0}
    
    def run(self):
        """Main execution loop"""
        print("\n" + "=" * 60)
        print(f"{Fore.MAGENTA}📱 Instagram DM Agent (Supabase + Steel.dev){Style.RESET_ALL}")
        print("=" * 60)
        
        print(f"\n📋 Configuration:")
        print(f"   User ID: {self.user_id[:8]}...")
        if self.campaign_id:
            print(f"   Campaign: {self.campaign_id[:8]}...")
        print(f"   Template: {self.template_name}")
        print(f"   Limit: {self.limit} DMs")
        print(f"   Delay between DMs: {DELAY_BETWEEN_DMS}s")
        print(f"   Headless: {self.headless}")
        print()
        
        # Get stats
        stats = self.get_stats()
        print(f"📊 Database Stats:")
        print(f"   Total leads:  {stats['total']}")
        print(f"   ✅ DM sent:   {stats['sent']}")
        print(f"   📬 Pending:   {stats['pending']}")
        print()
        
        # Load session
        session = self.get_instagram_session()
        if not session:
            self.log("Cannot proceed without valid Instagram session", "error")
            return
        
        # Load leads
        leads = self.load_leads()
        if not leads:
            self.log("No leads to message. Scrape some leads first!", "warning")
            return
        
        try:
            # Start browser with session
            if not self.start_browser(session):
                return
            
            # Verify session is valid
            if not self.is_logged_in():
                self.log("Session expired. Please reconnect Instagram via Steel.dev", "error")
                return
            
            # Send DMs in batches
            batch_num = 0
            for i in range(0, len(leads), BATCH_SIZE):
                batch = leads[i:i + BATCH_SIZE]
                batch_num += 1
                
                self.log(f"\n📦 Batch {batch_num} ({len(batch)} leads)...", "info")
                
                for lead in batch:
                    if self.dms_sent_today >= self.limit:
                        self.log(f"⚠️ Limit ({self.limit}) reached.", "warning")
                        return
                    
                    username = lead["username"]
                    message = lead["message"]
                    lead_id = lead["id"]
                    
                    # Double-check lead hasn't been messaged since we loaded it
                    # This prevents race conditions with parallel runs
                    check = self.supabase.table("leads").select("dm_sent").eq("id", lead_id).single().execute()
                    if check.data and check.data.get("dm_sent"):
                        self.log(f"⏭️ @{username} already messaged, skipping", "info")
                        continue
                    
                    result = self.send_dm(username, message)
                    
                    self.update_lead_status(
                        lead_id=lead["id"],
                        message=message,
                        success=result["success"],
                        error=result.get("error")
                    )
                    
                    if result["success"]:
                        delay = DELAY_BETWEEN_DMS + random.randint(-10, 30)
                        self.log(f"⏳ Waiting {delay}s before next DM...", "info")
                        time.sleep(delay)
                
                if i + BATCH_SIZE < len(leads):
                    delay = DELAY_BETWEEN_BATCHES + random.randint(-30, 60)
                    self.log(f"☕ Batch complete. {delay}s break...", "info")
                    time.sleep(delay)
            
            final_stats = self.get_stats()
            self.log(f"\n🎉 Complete! Sent {self.dms_sent_today} DMs.", "success")
            print(f"\n📊 Updated Stats:")
            print(f"   ✅ DM sent:   {final_stats['sent']}")
            print(f"   📬 Pending:   {final_stats['pending']}")
        
        except KeyboardInterrupt:
            self.log("\n⛔ Interrupted", "warning")
        except BrokenPipeError:
            self.log("Browser connection lost (EPIPE). Session may have expired.", "error")
        except Exception as e:
            error_str = str(e).lower()
            if "epipe" in error_str or "broken pipe" in error_str:
                self.log("Browser connection lost. Session may have expired.", "error")
            else:
                self.log(f"Unexpected error: {e}", "error")
        finally:
            # Safely close browser - ignore errors during cleanup
            try:
                if self.browser:
                    self.browser.close()
            except Exception:
                pass  # Browser may already be closed
            try:
                if self.playwright:
                    self.playwright.stop()
            except Exception:
                pass  # Playwright may already be stopped


def main():
    parser = argparse.ArgumentParser(description="Instagram DM Agent")
    parser.add_argument("--user-id", "-u", type=str, required=True,
                        help="User ID (UUID from Supabase)")
    parser.add_argument("--campaign-id", "-c", type=str, default=None,
                        help="Campaign ID to filter leads (optional)")
    parser.add_argument("--headless", action="store_true",
                        help="Run in headless mode")
    parser.add_argument("--template", "-t", choices=list(TEMPLATES.keys()), default="default",
                        help="Message template to use")
    parser.add_argument("--limit", "-l", type=int, default=None,
                        help="Maximum DMs to send")
    parser.add_argument("--test", action="store_true",
                        help="Test mode - load leads only")
    parser.add_argument("--stats", action="store_true",
                        help="Show stats only")
    
    args = parser.parse_args()
    
    agent = InstagramDMAgent(
        user_id=args.user_id,
        headless=args.headless,
        template=args.template,
        limit=args.limit,
        campaign_id=args.campaign_id
    )
    
    if args.stats:
        stats = agent.get_stats()
        print("\n📊 Lead Statistics")
        print("=" * 40)
        print(f"   Total leads:  {stats['total']}")
        print(f"   ✅ DM sent:   {stats['sent']}")
        print(f"   📬 Pending:   {stats['pending']}")
        print("=" * 40)
        return
    
    if args.test:
        print("🧪 Test mode - loading leads...")
        leads = agent.load_leads()
        if leads:
            print(f"\n📧 Preview of {len(leads)} leads:\n")
            for i, lead in enumerate(leads[:3]):
                print(f"--- Lead {i+1}: @{lead['username']} ({lead['full_name']}) ---")
                print(lead["message"])
                print()
        print("✅ Test complete!")
        return
    
    agent.run()


if __name__ == "__main__":
    main()

