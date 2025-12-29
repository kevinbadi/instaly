#!/usr/bin/env python3
"""
Instaly Worker - Instagram DM Automation
Runs on Mac Mini, polls database for active campaigns, sends DMs

Usage:
    python worker.py

Environment Variables Required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY - Service role key for admin access
    ANTHROPIC_API_KEY - For AI message generation
"""

import asyncio
import json
import os
import random
from datetime import datetime
from typing import Optional

import anthropic
from dotenv import load_dotenv
from loguru import logger
from playwright.async_api import async_playwright
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
POLL_INTERVAL = 60  # seconds between database polls
DM_DELAY_MIN = 30  # minimum seconds between DMs
DM_DELAY_MAX = 60  # maximum seconds between DMs

# Initialize Supabase client with service role key (bypasses RLS)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Setup logging
logger.add(
    "logs/worker_{time}.log",
    rotation="1 day",
    retention="7 days",
    level="INFO",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
)


def get_active_campaigns():
    """Get campaigns that are active and ready to run."""
    result = supabase.from_("campaigns")\
        .select("*, instagram_accounts!inner(*)")\
        .eq("status", "active")\
        .lte("next_run_at", datetime.now().isoformat())\
        .execute()
    
    # Filter by daily limit
    campaigns = []
    for campaign in result.data:
        account = campaign.get("instagram_accounts", {})
        if account.get("status") == "active" and \
           account.get("dms_sent_today", 0) < account.get("daily_dm_limit", 200):
            campaigns.append({
                "id": campaign["id"],
                "user_id": campaign["user_id"],
                "instagram_account_id": campaign["instagram_account_id"],
                "message_template": campaign.get("message_template"),
                "dms_per_session": campaign.get("dms_per_session", 10),
                "campaign_name": campaign.get("name"),
                "instagram_username": account.get("instagram_username"),
                "daily_dm_limit": account.get("daily_dm_limit", 200),
                "dms_sent_today": account.get("dms_sent_today", 0),
            })
    
    return campaigns


def get_session_data(instagram_account_id: str) -> Optional[dict]:
    """Get the stored Instagram session for automation."""
    result = supabase.from_("instagram_sessions")\
        .select("session_data")\
        .eq("instagram_account_id", instagram_account_id)\
        .eq("status", "active")\
        .single()\
        .execute()
    
    if result.data:
        session_data = result.data.get("session_data")
        if isinstance(session_data, str):
            return json.loads(session_data)
        return session_data
    return None


def get_leads_to_message(user_id: str, campaign_id: str, limit: int = 10):
    """Get leads that haven't been messaged yet."""
    result = supabase.from_("leads")\
        .select("id, instagram_username, full_name, bio, followers_count")\
        .eq("user_id", user_id)\
        .eq("campaign_id", campaign_id)\
        .eq("dm_sent", False)\
        .limit(limit)\
        .execute()
    
    return result.data or []


def generate_ai_message(lead_info: dict, custom_template: Optional[str] = None) -> str:
    """Generate personalized message using Claude."""
    if not ANTHROPIC_API_KEY:
        # Fallback to simple template
        name = lead_info.get("full_name", "").split()[0] if lead_info.get("full_name") else "there"
        return f"Hey {name}! I came across your profile and thought we should connect. Would love to chat!"
    
    if custom_template and custom_template != "ai":
        # Use custom template with variable substitution
        name = lead_info.get("full_name", "").split()[0] if lead_info.get("full_name") else "there"
        return custom_template.replace("{{name}}", name)
    
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    
    prompt = f"""Generate a short, friendly Instagram DM to start a conversation with someone.

Target Profile:
- Username: @{lead_info.get('instagram_username', 'user')}
- Name: {lead_info.get('full_name', 'N/A')}
- Bio: {lead_info.get('bio', 'N/A')}
- Followers: {lead_info.get('followers_count', 'N/A')}

Requirements:
- Keep it under 200 characters
- Be casual and genuine, not salesy
- Reference something from their profile if possible
- No hashtags or excessive emojis
- End with a question or conversation starter

Generate ONLY the message text, nothing else."""

    response = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.content[0].text.strip()


def mark_lead_as_messaged(lead_id: str, instagram_account_id: str, message: str):
    """Mark a lead as messaged in the database."""
    supabase.from_("leads")\
        .update({
            "dm_sent": True,
            "dm_sent_at": datetime.now().isoformat(),
            "dm_sent_by": instagram_account_id
        })\
        .eq("id", lead_id)\
        .execute()


def log_dm(campaign_id: str, lead_id: str, instagram_account_id: str, 
           message: str, status: str, error_message: Optional[str] = None):
    """Log a DM attempt to the database."""
    supabase.from_("dm_logs")\
        .insert({
            "campaign_id": campaign_id,
            "lead_id": lead_id,
            "instagram_account_id": instagram_account_id,
            "message_sent": message,
            "status": status,
            "error_message": error_message
        })\
        .execute()


def increment_dm_counter(instagram_account_id: str):
    """Increment the daily DM counter for an account."""
    # Get current count
    result = supabase.from_("instagram_accounts")\
        .select("dms_sent_today")\
        .eq("id", instagram_account_id)\
        .single()\
        .execute()
    
    current = result.data.get("dms_sent_today", 0) if result.data else 0
    
    supabase.from_("instagram_accounts")\
        .update({"dms_sent_today": current + 1})\
        .eq("id", instagram_account_id)\
        .execute()


def update_campaign_next_run(campaign_id: str):
    """Schedule next run in 1 hour."""
    next_run = datetime.now().replace(microsecond=0)
    next_run = next_run.replace(hour=next_run.hour + 1)
    
    supabase.from_("campaigns")\
        .update({
            "next_run_at": next_run.isoformat(),
            "last_run_at": datetime.now().isoformat()
        })\
        .eq("id", campaign_id)\
        .execute()


def update_campaign_dm_count(campaign_id: str, count: int):
    """Update total DMs sent for a campaign."""
    result = supabase.from_("campaigns")\
        .select("total_dms_sent")\
        .eq("id", campaign_id)\
        .single()\
        .execute()
    
    current = result.data.get("total_dms_sent", 0) if result.data else 0
    
    supabase.from_("campaigns")\
        .update({"total_dms_sent": current + count})\
        .eq("id", campaign_id)\
        .execute()


def mark_session_expired(instagram_account_id: str):
    """Mark a session as expired (needs re-authentication)."""
    supabase.from_("instagram_sessions")\
        .update({"status": "expired"})\
        .eq("instagram_account_id", instagram_account_id)\
        .execute()
    
    supabase.from_("instagram_accounts")\
        .update({"status": "needs_reauth"})\
        .eq("id", instagram_account_id)\
        .execute()


def reset_daily_counters():
    """Reset daily DM counters if it's a new day."""
    today = datetime.now().date().isoformat()
    
    supabase.from_("instagram_accounts")\
        .update({"dms_sent_today": 0, "last_dm_reset": today})\
        .lt("last_dm_reset", today)\
        .execute()


async def send_dm_batch(session_data: dict, leads: list, campaign: dict) -> int:
    """Send DMs to a batch of leads using Playwright."""
    sent_count = 0
    campaign_id = campaign["id"]
    instagram_account_id = campaign["instagram_account_id"]
    message_template = campaign.get("message_template")
    
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(storage_state=session_data)
            page = await context.new_page()
            
            # Navigate to Instagram DM inbox
            await page.goto("https://www.instagram.com/direct/inbox/")
            await asyncio.sleep(3)
            
            # Handle "Turn on notifications" popup
            try:
                not_now = page.locator('button:has-text("Not Now")')
                if await not_now.count() > 0:
                    await not_now.first.click()
                    await asyncio.sleep(1)
            except Exception:
                pass
            
            # Check if we're logged in
            try:
                await page.wait_for_selector('[aria-label="New message"]', timeout=10000)
            except Exception:
                logger.error(f"Session expired for account {instagram_account_id}")
                mark_session_expired(instagram_account_id)
                await browser.close()
                return 0
            
            for lead in leads:
                try:
                    username = lead["instagram_username"]
                    lead_id = lead["id"]
                    
                    logger.info(f"Sending DM to @{username}")
                    
                    # Navigate to inbox (fresh start for each DM)
                    await page.goto("https://www.instagram.com/direct/inbox/")
                    await asyncio.sleep(2)
                    
                    # Click compose/new message button
                    compose_button = page.locator('[aria-label="New message"]')
                    await compose_button.first.click()
                    await asyncio.sleep(2)
                    
                    # Search for user
                    search_input = page.locator('input[placeholder="Search..."]')
                    await search_input.first.fill(username)
                    await asyncio.sleep(3)
                    
                    # Find and click user in results
                    user_result = page.locator(f'div[role="dialog"] span:has-text("{username}")')
                    
                    if await user_result.count() == 0:
                        logger.warning(f"User @{username} not found in search results")
                        log_dm(campaign_id, lead_id, instagram_account_id, "", "failed", "User not found")
                        continue
                    
                    await user_result.first.click()
                    await asyncio.sleep(2)
                    
                    # Click Next/Chat button
                    next_button = page.locator('div[role="button"]:has-text("Next"), div[role="button"]:has-text("Chat")')
                    if await next_button.count() > 0:
                        await next_button.first.click()
                        await asyncio.sleep(3)
                    
                    # Generate personalized message
                    message = generate_ai_message(lead, message_template)
                    
                    # Type and send message
                    message_input = page.locator('textarea[placeholder*="Message"]')
                    if await message_input.count() == 0:
                        message_input = page.locator('[role="textbox"]')
                    
                    await message_input.first.click()
                    await page.keyboard.type(message, delay=random.randint(20, 50))
                    await asyncio.sleep(1)
                    
                    # Press Enter to send
                    await page.keyboard.press("Enter")
                    await asyncio.sleep(2)
                    
                    # Mark as sent
                    mark_lead_as_messaged(lead_id, instagram_account_id, message)
                    log_dm(campaign_id, lead_id, instagram_account_id, message, "sent")
                    increment_dm_counter(instagram_account_id)
                    sent_count += 1
                    
                    logger.info(f"✅ Sent DM to @{username}")
                    
                    # Human-like delay between messages
                    delay = random.randint(DM_DELAY_MIN, DM_DELAY_MAX)
                    logger.debug(f"Waiting {delay} seconds before next DM...")
                    await asyncio.sleep(delay)
                    
                except Exception as e:
                    logger.error(f"Failed to send DM to @{lead['instagram_username']}: {e}")
                    log_dm(
                        campaign_id, 
                        lead["id"], 
                        instagram_account_id, 
                        "", 
                        "failed", 
                        str(e)[:500]
                    )
            
            await browser.close()
            
        except Exception as e:
            logger.error(f"Browser error: {e}")
    
    return sent_count


async def run_campaign(campaign: dict):
    """Run a single campaign."""
    campaign_id = campaign["id"]
    user_id = campaign["user_id"]
    instagram_account_id = campaign["instagram_account_id"]
    campaign_name = campaign["campaign_name"]
    ig_username = campaign["instagram_username"]
    dms_per_session = campaign.get("dms_per_session", 10)
    
    # Calculate remaining DMs allowed today
    daily_limit = campaign["daily_dm_limit"]
    dms_sent_today = campaign["dms_sent_today"]
    remaining_today = daily_limit - dms_sent_today
    
    if remaining_today <= 0:
        logger.info(f"⏸️ Daily limit reached for @{ig_username}")
        update_campaign_next_run(campaign_id)
        return
    
    # Limit DMs to what's remaining today
    dms_to_send = min(dms_per_session, remaining_today)
    
    logger.info(f"▶️ Running campaign '{campaign_name}' for @{ig_username}")
    
    # Get session data
    session_data = get_session_data(instagram_account_id)
    if not session_data:
        logger.warning(f"❌ No valid session for @{ig_username}")
        return
    
    # Get leads to message
    leads = get_leads_to_message(user_id, campaign_id, limit=dms_to_send)
    if not leads:
        logger.info(f"⚠️ No leads to message for @{ig_username}")
        update_campaign_next_run(campaign_id)
        return
    
    # Send DMs
    sent = await send_dm_batch(session_data, leads, campaign)
    
    logger.info(f"✅ Sent {sent} DMs for @{ig_username}")
    
    # Update campaign stats
    update_campaign_dm_count(campaign_id, sent)
    update_campaign_next_run(campaign_id)


async def worker_loop():
    """Main worker loop - runs forever."""
    logger.info("🚀 Instaly Worker started!")
    logger.info(f"   Polling Supabase every {POLL_INTERVAL} seconds...")
    
    # Install Playwright browsers on first run
    logger.info("📦 Ensuring Playwright browsers are installed...")
    os.system("playwright install chromium")
    
    # Create logs directory
    os.makedirs("logs", exist_ok=True)
    
    while True:
        try:
            # Reset daily counters if needed
            reset_daily_counters()
            
            # Get active campaigns
            campaigns = get_active_campaigns()
            
            if campaigns:
                logger.info(f"\n📋 Found {len(campaigns)} campaigns ready to run")
                
                # Run campaigns sequentially to avoid rate limits
                for campaign in campaigns:
                    try:
                        await run_campaign(campaign)
                    except Exception as e:
                        logger.error(f"Campaign error: {e}")
                    
                    # Small delay between campaigns
                    await asyncio.sleep(5)
            else:
                # Heartbeat
                print(".", end="", flush=True)
            
        except Exception as e:
            logger.error(f"\n❌ Worker error: {e}")
        
        await asyncio.sleep(POLL_INTERVAL)


def main():
    """Entry point."""
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║   ██╗███╗   ██╗███████╗████████╗ █████╗ ██╗  ██╗   ██╗    ║
    ║   ██║████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██║  ╚██╗ ██╔╝    ║
    ║   ██║██╔██╗ ██║███████╗   ██║   ███████║██║   ╚████╔╝     ║
    ║   ██║██║╚██╗██║╚════██║   ██║   ██╔══██║██║    ╚██╔╝      ║
    ║   ██║██║ ╚████║███████║   ██║   ██║  ██║███████╗██║       ║
    ║   ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝       ║
    ║                                                           ║
    ║          Instagram DM Automation Worker                   ║
    ║              Powered by Supabase                          ║
    ╚═══════════════════════════════════════════════════════════╝
    """)
    
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
