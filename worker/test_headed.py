#!/usr/bin/env python3
"""
Test script - Run DM agent with VISIBLE browser for monitoring
Usage: python3 test_headed.py
"""

import os
import sys

# Increase SLOW_MO for more stable browser automation
os.environ["SLOW_MO"] = "200"

from dm_agent import InstagramDMAgent

def main():
    print('🧪 TEST MODE: Sending 3 DMs with visible browser')
    print('=' * 50)
    print('Browser will stay open for inspection after completion')
    print('Press Ctrl+C to stop at any time')
    print('=' * 50)
    print()
    
    agent = InstagramDMAgent(
        user_id='43632e54-9e67-41a5-a8d2-363da8b37b9b',
        headless=False,  # VISIBLE BROWSER
        template='Hey {{fullName}}, we have a podcast where we interview business owners and chat about what defines success. Any interest in coming on there?',
        limit=3,  # ONLY 3 DMs for test
        campaign_id='c82b6ff1-f3ee-48be-b0c8-84b2d41c62ad'
    )
    
    # Override the cleanup behavior to keep browser open
    original_run = agent.run
    
    def run_without_cleanup():
        """Run but don't auto-close browser"""
        import time
        from dm_agent import DELAY_BETWEEN_DMS, BATCH_SIZE
        import random
        
        # Print config
        print("=" * 60)
        print("📱 Instagram DM Agent (TEST MODE)")
        print("=" * 60)
        print()
        print("📋 Configuration:")
        print(f"   User ID: {agent.user_id[:8]}...")
        if agent.campaign_id:
            print(f"   Campaign: {agent.campaign_id[:8]}...")
        print(f"   Template: {agent.template[:50]}...")
        print(f"   Limit: {agent.limit} DMs")
        print(f"   Headless: {agent.headless}")
        print()
        
        # Get stats
        stats = agent.get_stats()
        print(f"📊 Database Stats:")
        print(f"   Total leads:  {stats['total']}")
        print(f"   ✅ DM sent:   {stats['sent']}")
        print(f"   📬 Pending:   {stats['pending']}")
        print()
        
        # Load session
        session = agent.get_instagram_session()
        if not session:
            agent.log("Cannot proceed without valid Instagram session", "error")
            return
        
        # Load leads
        leads = agent.load_leads()
        if not leads:
            agent.log("No leads to message!", "warning")
            return
        
        # Start browser
        if not agent.start_browser(session):
            return
        
        # Verify session
        if not agent.is_logged_in():
            agent.log("Session expired!", "error")
            print("\n🔍 Browser left open for inspection. Press Enter to close...")
            input()
            return
        
        # Send DMs
        for i, lead in enumerate(leads):
            if agent.dms_sent_today >= agent.limit:
                agent.log(f"⚠️ Limit ({agent.limit}) reached.", "warning")
                break
            
            username = lead["username"]
            message = lead["message"]
            lead_id = lead["id"]
            
            agent.log(f"\n📦 DM {i+1}/{len(leads)}...", "info")
            
            result = agent.send_dm(username, message)
            
            agent.update_lead_status(
                lead_id=lead_id,
                message=message,
                success=result["success"],
                error=result.get("error")
            )
            
            if i < len(leads) - 1:  # Don't wait after last DM
                delay = DELAY_BETWEEN_DMS + random.randint(0, 45)
                agent.log(f"⏳ Waiting {delay}s before next DM...", "info")
                time.sleep(delay)
        
        print("\n✅ Test complete!")
        print(f"   Sent: {agent.dms_sent_today} DMs")
    
    try:
        run_without_cleanup()
    except KeyboardInterrupt:
        print("\n\n⛔ Test stopped by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    # Always keep browser open
    print("\n" + "=" * 50)
    print("🔍 Browser left open for inspection")
    print("   Press Enter to close browser...")
    print("=" * 50)
    
    try:
        input()
    except:
        pass
    
    # Now cleanup
    try:
        if agent.browser:
            agent.browser.close()
        if agent.playwright:
            agent.playwright.stop()
    except:
        pass


if __name__ == "__main__":
    main()

