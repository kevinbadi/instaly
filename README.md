# Instaly - Instagram DM Automation SaaS

Automate Instagram DMs at scale with AI-powered personalization.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│    Supabase     │◀────│  Python Worker  │
│   (Vercel)      │     │   (Database)    │     │   (Mac Mini)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        ▼                                               ▼
┌─────────────────┐                           ┌─────────────────┐
│   Steel.dev     │                           │   Playwright    │
│ (IG Sessions)   │                           │  (Send DMs)     │
└─────────────────┘                           └─────────────────┘
```

## Deploy to Vercel

### 1. Fork & Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kevinbadi/instaly)

### 2. Set Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `STEEL_API_KEY` | ✅ | Steel.dev API key for Instagram sessions |
| `PHANTOMBUSTER_API_KEY` | ✅ | PhantomBuster API key |
| `PHANTOMBUSTER_AGENT_ID` | ✅ | PhantomBuster Instagram Likers agent ID |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your Vercel app URL |
| `ANTHROPIC_API_KEY` | ⚪ | Optional: For AI-powered messages |
| `STRIPE_*` | ⚪ | Optional: For payments |

### 3. Set Up Supabase

1. Create a new Supabase project
2. Run the schema from `database/schema.sql` in the SQL editor
3. Enable Email Auth in Authentication → Providers
4. Add your Vercel URL to Authentication → URL Configuration

### 4. Set Up Worker (Mac Mini)

The worker runs on a Mac Mini and sends the actual DMs.

```bash
cd worker
pip install -r requirements.txt
playwright install chromium

# Create .env file with:
# SUPABASE_URL=your-url
# SUPABASE_SERVICE_ROLE_KEY=your-key
# ANTHROPIC_API_KEY=your-key (optional)

# Start the worker
./setup_service.sh
```

## Local Development

```bash
# Frontend
cd frontend
cp env.template .env.local
# Fill in your keys
npm install
npm run dev

# Worker
cd worker
pip install -r requirements.txt
python campaign_worker.py --once
```

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, shadcn/ui, Framer Motion
- **Database**: Supabase (PostgreSQL + Auth)
- **Instagram Sessions**: Steel.dev (cloud browsers)
- **Lead Scraping**: PhantomBuster
- **DM Automation**: Playwright + Python
- **Payments**: Stripe (optional)

## License

Private - All rights reserved.
