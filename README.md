# INSTALY - Instagram DM Automation Platform

INSTALY is a full-stack SaaS platform for automating personalized Instagram DM outreach. It combines a Next.js frontend, Supabase backend, and Python worker agents to send messages at scale while maintaining human-like behavior.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema](#database-schema)
4. [Project Structure](#project-structure)
5. [Setup Instructions](#setup-instructions)
6. [Environment Variables](#environment-variables)
7. [Worker Agents](#worker-agents)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌──────────────────┐                                    ┌──────────────────┐
│   USER BROWSER   │◄──────── HTTPS ──────────────────►│   VERCEL (CDN)   │
│  - Dashboard     │                                    │   Next.js App    │
│  - Campaigns     │                                    │   - API Routes   │
│  - Leads         │                                    │   - React UI     │
└──────────────────┘                                    └────────┬─────────┘
                                                                 │
                                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (PostgreSQL + Auth)                         │
│   users | campaigns | leads | dm_logs | instagram_accounts | sessions       │
└─────────────────────────────────────────────────────────────────────────────┘
                                         ▲
                                         │
┌────────────────────────────────────────┴────────────────────────────────────┐
│                      MAC MINI / LOCAL MACHINE (Worker)                      │
│                                                                             │
│   launchd/Task Scheduler → campaign_worker.py → dm_agent.py → Playwright   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INSTAGRAM.COM                                  │
│                    /direct/inbox/ → Search → Send DM                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How It Works

1. **Users** create campaigns and import leads via the web dashboard
2. **Supabase** stores all data (users, campaigns, leads, sessions, logs)
3. **Worker agents** run on a local machine (Mac Mini), polling Supabase every 60 seconds
4. When a campaign is active, the worker launches **Playwright** to automate Instagram DMs
5. Each DM is logged back to Supabase, updating the dashboard in real-time

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Auth | Clerk (or Supabase Auth) |
| Database | Supabase (PostgreSQL) |
| Payments | Stripe |
| Worker | Python 3.9+, Playwright |
| Session Capture | Steel.dev |
| Hosting (Frontend) | Vercel |
| Hosting (Worker) | Local Mac Mini / Any always-on machine |

---

## Database Schema

### Tables Overview

```sql
-- Core user data (extends Supabase auth.users)
users
├── id (UUID, PK, references auth.users)
├── email (TEXT)
├── name (TEXT)
├── stripe_customer_id (TEXT)
├── subscription_status (TEXT: 'active', 'inactive', 'cancelled')
├── subscription_tier (TEXT: 'starter', 'growth', 'scale')
├── created_at, updated_at (TIMESTAMPTZ)

-- Connected Instagram accounts
instagram_accounts
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── instagram_username (TEXT)
├── status (TEXT: 'active', 'needs_reauth', 'disabled')
├── daily_dm_limit (INTEGER, default 200)
├── dms_sent_today (INTEGER)
├── created_at (TIMESTAMPTZ)

-- Stored browser sessions for automation
instagram_sessions
├── id (UUID, PK)
├── instagram_account_id (UUID, FK → instagram_accounts)
├── session_data (JSONB) -- Playwright storage_state (cookies + localStorage)
├── session_id (TEXT)
├── csrf_token (TEXT)
├── status (TEXT: 'active', 'expired', 'flagged')
├── captured_at, last_used_at (TIMESTAMPTZ)

-- Automation campaigns
campaigns
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── instagram_account_id (UUID, FK → instagram_accounts)
├── name (TEXT)
├── status (TEXT: 'active', 'paused', 'completed')
├── message_template (TEXT) -- Supports {{fullName}}, {{username}} variables
├── scrape_urls (TEXT[])
├── dms_per_session (INTEGER, default 10)
├── sessions_per_day (INTEGER, default 15)
├── next_run_at (TIMESTAMPTZ) -- Cooldown timestamp
├── last_run_at (TIMESTAMPTZ)
├── total_dms_sent (INTEGER)
├── created_at, updated_at (TIMESTAMPTZ)

-- Scraped/imported leads
leads
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── campaign_id (UUID, FK → campaigns)
├── instagram_username (TEXT)
├── full_name (TEXT)
├── profile_url (TEXT)
├── bio (TEXT)
├── followers_count (INTEGER)
├── is_verified (BOOLEAN)
├── source_post_url (TEXT)
├── dm_sent (BOOLEAN)
├── dm_sent_at (TIMESTAMPTZ)
├── dm_sent_by (UUID, FK → instagram_accounts)
├── created_at (TIMESTAMPTZ)
├── UNIQUE(user_id, instagram_username)

-- Audit trail for all DM attempts
dm_logs
├── id (UUID, PK)
├── campaign_id (UUID, FK → campaigns)
├── lead_id (UUID, FK → leads)
├── instagram_account_id (UUID, FK → instagram_accounts)
├── message_sent (TEXT)
├── status (TEXT: 'sent', 'failed', 'blocked')
├── error_message (TEXT)
├── sent_at (TIMESTAMPTZ)
```

### Key Relationships

- `users` ← `instagram_accounts` (one-to-many)
- `instagram_accounts` ← `instagram_sessions` (one-to-one)
- `users` ← `campaigns` (one-to-many)
- `campaigns` ← `leads` (one-to-many)
- `campaigns` ← `dm_logs` (one-to-many)

---

## Project Structure

```
INSTALY/
├── frontend/                    # Next.js web application
│   ├── src/
│   │   ├── app/                 # App router pages & API routes
│   │   │   ├── (auth)/          # Auth pages (sign-in, sign-up)
│   │   │   ├── (dashboard)/     # Protected dashboard pages
│   │   │   └── api/             # API endpoints
│   │   ├── components/          # React components
│   │   └── lib/                 # Utilities (db.ts, supabase client)
│   ├── package.json
│   └── .env.local               # Frontend environment variables
│
├── worker/                      # Python worker agents
│   ├── campaign_worker.py       # Main polling loop
│   ├── dm_agent.py              # Instagram DM automation
│   ├── lead_scraper.py          # Lead scraping utilities
│   ├── steel_navigator.py       # Steel.dev session capture
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # Worker environment variables
│   ├── logs/                    # Log files
│   │   ├── campaign_worker.log
│   │   └── campaign_worker_error.log
│   └── com.instaly.campaignworker.plist  # macOS launchd config
│
├── database/
│   └── schema.sql               # Full database schema
│
├── supabase/
│   └── migrations/              # Database migrations
│
└── README.md                    # This file
```

---

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Supabase account
- Stripe account (for payments)
- Clerk account (for auth) OR use Supabase Auth
- Steel.dev account (for session capture)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/instaly.git
cd instaly
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema:
   ```bash
   # Copy contents of database/schema.sql and run in SQL Editor
   ```
3. Note your project URL and keys from Project Settings → API

### 3. Set Up Frontend

```bash
cd frontend
npm install

# Copy environment template
cp env.template .env.local

# Edit .env.local with your values (see Environment Variables section)
```

### 4. Set Up Worker

```bash
cd worker
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Copy environment template
cp env.template .env

# Edit .env with your values (see Environment Variables section)
```

### 5. Set Up Steel.dev (Session Capture)

1. Create account at [steel.dev](https://steel.dev)
2. Get your API key from the dashboard
3. Add to worker/.env as `STEEL_API_KEY`

### 6. Run Locally

**Frontend:**
```bash
cd frontend
npm run dev
# Opens at http://localhost:3000
```

**Worker (manual):**
```bash
cd worker
python3 campaign_worker.py --once  # Single run
python3 campaign_worker.py         # Continuous polling
```

---

## Environment Variables

### Frontend (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Steel.dev
STEEL_API_KEY=steel_...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Worker (.env)

```bash
# Supabase (use service role key for worker)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Worker Settings
WORKER_POLL_INTERVAL=60          # Seconds between checks
WORKER_DMS_PER_RUN=10            # DMs per campaign run
WORKER_COOLDOWN_MINUTES=30       # Cooldown between runs
MAX_PARALLEL_CAMPAIGNS=5         # Max concurrent campaigns
DAILY_DM_LIMIT=150               # Instagram daily limit

# DM Agent Settings
DELAY_BETWEEN_DMS=60             # Seconds between DMs
DELAY_BETWEEN_BATCHES=300        # Seconds between batches
BATCH_SIZE=10
MAX_DMS_PER_DAY=50
HEADLESS=true                    # Run browser headless

# Steel.dev (optional, for session capture)
STEEL_API_KEY=steel_...
```

---

## Worker Agents

### campaign_worker.py

The main orchestrator that runs continuously (or via scheduled task):

1. **Polls every 60 seconds** for active campaigns
2. **Checks cooldowns** - skips campaigns still in cooldown period
3. **Enforces daily limits** - tracks DMs per Instagram account in last 24h
4. **Spawns dm_agent.py** for each ready campaign
5. **Runs campaigns in parallel** using threads (up to MAX_PARALLEL_CAMPAIGNS)
6. **Sets cooldown** after each run (default 30 minutes)

### dm_agent.py

The Instagram automation engine:

1. **Loads session** from Supabase (cookies + localStorage)
2. **Starts Playwright** with the captured session
3. **Validates session** by checking for logged-in indicators
4. **For each lead:**
   - Navigates to Instagram inbox
   - Clicks compose, searches for username
   - Verifies correct conversation opened
   - Types personalized message (using {{fullName}}, {{username}})
   - Sends and confirms delivery
   - Updates lead status in database
   - Logs result to dm_logs table
   - Waits 60-90 seconds (human pacing)

### Running as a Scheduled Service

**macOS (launchd):**

```bash
# Install the service
cd worker
./setup_service.sh

# The plist file runs the worker on login and keeps it running
# Logs go to worker/logs/
```

**Windows (Task Scheduler):**

1. Open Task Scheduler
2. Create new task → Trigger: "At startup" or schedule
3. Action: Start program → `python3` with arguments `C:\path\to\campaign_worker.py`
4. Set "Run whether user is logged on or not"

**Linux (systemd):**

```ini
# /etc/systemd/system/instaly-worker.service
[Unit]
Description=INSTALY Campaign Worker
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/worker
ExecStart=/usr/bin/python3 campaign_worker.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable instaly-worker
sudo systemctl start instaly-worker
```

---

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Worker (Always-On Machine)

The worker needs to run on a machine that's always on:

- **Mac Mini** - Great for reliability, use launchd
- **Home server** - Linux with systemd
- **Cloud VM** - AWS EC2, DigitalOcean, etc.
- **Raspberry Pi** - Low power, runs 24/7

**Note:** The worker uses Playwright which requires a display or virtual framebuffer (Xvfb) for headless mode on Linux servers.

---

## Troubleshooting

### Common Issues

**"Session expired" errors:**
- Instagram sessions expire after ~30 days
- Re-capture session via Steel.dev connect flow
- The worker automatically marks accounts as `needs_reauth`

**"Instagram block detected" false positives:**
- The agent checks for block phrases in page content
- Fixed by confirming message appears in conversation before flagging

**Worker not processing campaigns:**
- Check if worker process is running: `ps aux | grep campaign_worker`
- Check logs: `tail -f worker/logs/campaign_worker.log`
- Verify campaign status is 'active' in database
- Check cooldown: `next_run_at` must be in the past

**DMs not showing in dashboard:**
- Activity heatmap reads from `leads.dm_sent_at`
- Ensure the worker is updating lead status after sends

### Logs

```bash
# Watch worker logs in real-time
tail -f worker/logs/campaign_worker.log

# Check for errors
tail -f worker/logs/campaign_worker_error.log
```

### Manual Testing

```bash
# Run worker once to test
python3 campaign_worker.py --once

# Dry run (shows what would be processed)
python3 campaign_worker.py --dry-run

# Test DM agent directly
python3 dm_agent.py --user-id <uuid> --template "Hello {{fullName}}!" --limit 1 --test
```

---

## License

MIT License - See LICENSE file for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## Support

For issues and questions, open a GitHub issue or contact the maintainers.

