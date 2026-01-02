#!/usr/bin/env python3
"""
PhantomBuster Integration for Lead Scraping
Scrapes users who liked/commented on Instagram posts

Usage:
    from phantombuster import scrape_post_likers

Environment Variables Required:
    PHANTOMBUSTER_API_KEY - Your PhantomBuster API key
    PHANTOMBUSTER_AGENT_ID - Your Instagram Post Likers agent ID
"""

import os
import time
from typing import List, Optional

import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

PHANTOMBUSTER_API_KEY = os.environ.get("PHANTOMBUSTER_API_KEY")
PHANTOMBUSTER_AGENT_ID = os.environ.get("PHANTOMBUSTER_AGENT_ID")
DATABASE_URL = os.environ.get("DATABASE_URL")

BASE_URL = "https://api.phantombuster.com/api/v2"


def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def get_instagram_session_cookie(instagram_account_id: str) -> Optional[str]:
    """Get the session cookie for an Instagram account."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT session_id FROM instagram_sessions
        WHERE instagram_account_id = %s AND status = 'active'
    """, (instagram_account_id,))
    
    result = cur.fetchone()
    conn.close()
    
    return result["session_id"] if result else None


def scrape_post_likers(
    post_url: str,
    session_cookie: str,
    user_id: str,
    campaign_id: str,
    max_likers: int = 100
) -> List[dict]:
    """
    Scrape users who liked an Instagram post using PhantomBuster.
    
    Args:
        post_url: Instagram post URL to scrape
        session_cookie: Instagram session cookie (sessionid)
        user_id: User ID in our database
        campaign_id: Campaign ID for the leads
        max_likers: Maximum number of likers to scrape
    
    Returns:
        List of scraped leads
    """
    if not PHANTOMBUSTER_API_KEY or not PHANTOMBUSTER_AGENT_ID:
        logger.error("PhantomBuster credentials not configured")
        return []
    
    headers = {"X-Phantombuster-Key": PHANTOMBUSTER_API_KEY}
    
    # 1. Launch the phantom
    logger.info(f"Launching PhantomBuster to scrape: {post_url}")
    
    launch_response = requests.post(
        f"{BASE_URL}/agents/launch",
        headers=headers,
        json={
            "id": PHANTOMBUSTER_AGENT_ID,
            "argument": {
                "spreadsheetUrl": post_url,
                "sessionCookie": session_cookie,
                "numberOfLikersPerPost": max_likers
            }
        }
    )
    
    if launch_response.status_code != 200:
        logger.error(f"Failed to launch phantom: {launch_response.text}")
        return []
    
    container_id = launch_response.json().get("containerId")
    
    if not container_id:
        logger.error("No container ID returned from PhantomBuster")
        return []
    
    # 2. Wait for completion (poll every 10 seconds)
    logger.info(f"Waiting for PhantomBuster to complete (container: {container_id})...")
    
    max_wait = 300  # 5 minutes max
    elapsed = 0
    poll_interval = 10
    
    while elapsed < max_wait:
        status_response = requests.get(
            f"{BASE_URL}/containers/fetch",
            headers=headers,
            params={"id": container_id}
        )
        
        if status_response.status_code != 200:
            logger.error(f"Failed to fetch container status: {status_response.text}")
            return []
        
        status = status_response.json().get("status")
        
        if status == "finished":
            logger.info("PhantomBuster completed!")
            break
        elif status == "error":
            logger.error("PhantomBuster encountered an error")
            return []
        
        time.sleep(poll_interval)
        elapsed += poll_interval
    
    if elapsed >= max_wait:
        logger.error("PhantomBuster timed out")
        return []
    
    # 3. Fetch results
    output_response = requests.get(
        f"{BASE_URL}/agents/fetch-output",
        headers=headers,
        params={"id": PHANTOMBUSTER_AGENT_ID}
    )
    
    if output_response.status_code != 200:
        logger.error(f"Failed to fetch output: {output_response.text}")
        return []
    
    result_object = output_response.json().get("resultObject", [])
    
    if not result_object:
        logger.warning("No likers found")
        return []
    
    # 4. Store leads in database
    conn = get_db_connection()
    cur = conn.cursor()
    
    leads = []
    for liker in result_object:
        try:
            cur.execute("""
                INSERT INTO leads (
                    user_id, campaign_id, instagram_username, 
                    full_name, profile_url, bio, followers_count, 
                    is_verified, source_post_url
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, instagram_username) DO NOTHING
                RETURNING id
            """, (
                user_id,
                campaign_id,
                liker.get("username", ""),
                liker.get("fullName"),
                liker.get("profileUrl"),
                liker.get("bio"),
                liker.get("followersCount"),
                liker.get("isVerified", False),
                post_url
            ))
            
            result = cur.fetchone()
            if result:
                leads.append({
                    "id": result["id"],
                    "username": liker.get("username"),
                    "full_name": liker.get("fullName"),
                })
        except Exception as e:
            logger.error(f"Failed to insert lead {liker.get('username')}: {e}")
    
    conn.commit()
    conn.close()
    
    logger.info(f"✅ Scraped and saved {len(leads)} leads from {post_url}")
    return leads


def scrape_campaign_urls(campaign_id: str):
    """
    Scrape all URLs configured for a campaign.
    
    Args:
        campaign_id: Campaign ID to scrape URLs for
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get campaign details
    cur.execute("""
        SELECT c.id, c.user_id, c.instagram_account_id, c.scrape_urls
        FROM campaigns c
        WHERE c.id = %s
    """, (campaign_id,))
    
    campaign = cur.fetchone()
    conn.close()
    
    if not campaign:
        logger.error(f"Campaign {campaign_id} not found")
        return
    
    scrape_urls = campaign.get("scrape_urls", [])
    
    if not scrape_urls:
        logger.warning(f"No URLs configured for campaign {campaign_id}")
        return
    
    # Get session cookie
    session_cookie = get_instagram_session_cookie(campaign["instagram_account_id"])
    
    if not session_cookie:
        logger.error(f"No valid session for campaign {campaign_id}")
        return
    
    # Scrape each URL
    total_leads = 0
    for url in scrape_urls:
        try:
            leads = scrape_post_likers(
                post_url=url,
                session_cookie=session_cookie,
                user_id=campaign["user_id"],
                campaign_id=campaign["id"]
            )
            total_leads += len(leads)
            
            # Rate limit between scrapes
            time.sleep(30)
        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")
    
    logger.info(f"✅ Completed scraping for campaign {campaign_id}: {total_leads} total leads")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python phantombuster.py <campaign_id>")
        sys.exit(1)
    
    campaign_id = sys.argv[1]
    scrape_campaign_urls(campaign_id)





