#!/usr/bin/env python3
"""
Steel Navigator Worker - Runs on Mac Mini
Polls Supabase for pending Steel sessions and navigates them to Instagram using Playwright.
"""

import os
import time
import asyncio
from datetime import datetime
from playwright.async_api import async_playwright
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")  # Service role key
STEEL_API_KEY = os.getenv("STEEL_API_KEY")
POLL_INTERVAL = 2  # Check every 2 seconds

class SteelNavigator:
    def __init__(self):
        if not all([SUPABASE_URL, SUPABASE_KEY, STEEL_API_KEY]):
            raise ValueError("Missing required environment variables: SUPABASE_URL, SUPABASE_KEY, STEEL_API_KEY")
        
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("🚀 Steel Navigator Worker started")
        print(f"   Polling every {POLL_INTERVAL} seconds...")

    async def run(self):
        """Main loop - polls for pending navigation tasks"""
        while True:
            try:
                await self.process_pending_tasks()
            except Exception as e:
                print(f"❌ Error in main loop: {e}")
            
            await asyncio.sleep(POLL_INTERVAL)

    async def process_pending_tasks(self):
        """Check for and process pending navigation tasks"""
        try:
            # Get pending tasks
            response = self.supabase.table("steel_navigation_queue") \
                .select("*") \
                .eq("status", "pending") \
                .order("created_at") \
                .limit(1) \
                .execute()

            if not response.data:
                return  # No pending tasks

            task = response.data[0]
            task_id = task["id"]
            session_id = task["steel_session_id"]
            target_url = task["target_url"]

            print(f"\n✨ Found pending task: {task_id}")
            print(f"   Session: {session_id}")
            print(f"   Target: {target_url}")

            # Mark as navigating
            self.supabase.table("steel_navigation_queue") \
                .update({"status": "navigating", "updated_at": datetime.now().isoformat()}) \
                .eq("id", task_id) \
                .execute()

            # Navigate
            success = await self.navigate_session(session_id, target_url)

            if success:
                # Mark as ready
                self.supabase.table("steel_navigation_queue") \
                    .update({"status": "ready", "updated_at": datetime.now().isoformat()}) \
                    .eq("id", task_id) \
                    .execute()
                print(f"✅ Navigation complete! Session ready for user.")
            else:
                # Mark as failed
                self.supabase.table("steel_navigation_queue") \
                    .update({
                        "status": "failed",
                        "error_message": "Navigation failed",
                        "updated_at": datetime.now().isoformat()
                    }) \
                    .eq("id", task_id) \
                    .execute()
                print(f"❌ Navigation failed for session {session_id}")

        except Exception as e:
            print(f"❌ Error processing tasks: {e}")

    async def navigate_session(self, session_id: str, target_url: str) -> bool:
        """Connect to Steel session and navigate to target URL"""
        try:
            async with async_playwright() as p:
                # Connect to Steel browser via WebSocket
                ws_url = f"wss://connect.steel.dev?sessionId={session_id}&apiKey={STEEL_API_KEY}"
                print(f"   Connecting to Steel browser...")
                
                browser = await p.chromium.connect_over_cdp(ws_url)
                
                # Get the default context and page
                contexts = browser.contexts
                if contexts:
                    context = contexts[0]
                    pages = context.pages
                    if pages:
                        page = pages[0]
                    else:
                        page = await context.new_page()
                else:
                    context = await browser.new_context()
                    page = await context.new_page()

                # Try to navigate - but don't fail if Instagram blocks
                print(f"   Navigating to {target_url}...")
                try:
                    await page.goto(target_url, wait_until="commit", timeout=15000)
                    await asyncio.sleep(2)
                    print(f"   ✅ Page loaded: {page.url}")
                except Exception as nav_error:
                    print(f"   ⚠️ Navigation blocked (Instagram may be blocking cloud IPs): {nav_error}")
                    print(f"   ℹ️ Browser is still usable - user can manually navigate")
                    # Still return True - browser is ready, just not on Instagram
                
                # Don't close the browser - user needs it!
                return True

        except Exception as e:
            print(f"   ❌ Connection error: {e}")
            return False


async def main():
    navigator = SteelNavigator()
    await navigator.run()


if __name__ == "__main__":
    print("=" * 50)
    print("Steel Navigator Worker")
    print("=" * 50)
    asyncio.run(main())
