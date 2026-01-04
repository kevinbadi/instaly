#!/usr/bin/env python3
"""
Steel Session Worker
Polls Supabase for pending Steel sessions and navigates them to Instagram
Runs on Mac Mini alongside the campaign worker
"""

import os
import sys
import time
import subprocess
import json
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")  # Service role key
STEEL_API_KEY = os.getenv("STEEL_API_KEY")
POLL_INTERVAL = 2  # Check every 2 seconds

def log(message: str, level: str = "info"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    icons = {"info": "ℹ️", "success": "✅", "error": "❌", "warning": "⚠️"}
    print(f"[{timestamp}] {icons.get(level, 'ℹ️')} {message}")

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def navigate_session(session_id: str) -> bool:
    """Use Playwright to navigate Steel session to Instagram"""
    script_path = os.path.join(os.path.dirname(__file__), "navigate-steel.js")
    
    try:
        log(f"Navigating session {session_id}...")
        result = subprocess.run(
            ["node", script_path, session_id, STEEL_API_KEY],
            capture_output=True,
            text=True,
            timeout=45
        )
        
        try:
            output = json.loads(result.stdout.strip())
            if output.get("success"):
                log(f"Navigation successful for {session_id}", "success")
                return True
            else:
                log(f"Navigation failed: {output.get('error')}", "error")
                return False
        except json.JSONDecodeError:
            log(f"Script error: {result.stderr or result.stdout}", "error")
            return False
            
    except subprocess.TimeoutExpired:
        log(f"Navigation timed out for {session_id}", "error")
        return False
    except Exception as e:
        log(f"Navigation error: {e}", "error")
        return False

def process_pending_sessions():
    """Check for and process pending sessions"""
    supabase = get_supabase()
    
    # Get pending sessions
    result = supabase.table("steel_session_queue").select("*").eq("status", "pending").execute()
    
    for session in result.data:
        queue_id = session["id"]
        steel_session_id = session["session_id"]
        
        log(f"Found pending session: {steel_session_id}")
        
        # Mark as navigating
        supabase.table("steel_session_queue").update({
            "status": "navigating",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", queue_id).execute()
        
        # Navigate
        success = navigate_session(steel_session_id)
        
        # Update status
        new_status = "ready" if success else "failed"
        supabase.table("steel_session_queue").update({
            "status": new_status,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", queue_id).execute()
        
        log(f"Session {steel_session_id} -> {new_status}", "success" if success else "error")

def main():
    log("🚀 Steel Session Worker started")
    log(f"Polling every {POLL_INTERVAL} seconds...")
    
    if not all([SUPABASE_URL, SUPABASE_KEY, STEEL_API_KEY]):
        log("Missing environment variables!", "error")
        sys.exit(1)
    
    while True:
        try:
            process_pending_sessions()
        except Exception as e:
            log(f"Error in main loop: {e}", "error")
        
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()





