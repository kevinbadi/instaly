-- Instaly Database Schema for Supabase
-- Run this in the Supabase SQL Editor to set up all tables

-- Note: Supabase already has auth.users table, we'll reference it with user IDs

-- Users table (extends Supabase auth.users with app-specific data)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    stripe_customer_id TEXT,
    subscription_status TEXT DEFAULT 'inactive', -- 'active', 'inactive', 'cancelled'
    subscription_tier TEXT DEFAULT 'starter', -- 'starter', 'growth', 'scale'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instagram accounts connected by users
CREATE TABLE IF NOT EXISTS public.instagram_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    instagram_username TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'needs_reauth', 'disabled'
    daily_dm_limit INTEGER DEFAULT 200,
    dms_sent_today INTEGER DEFAULT 0,
    last_dm_reset DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, instagram_username)
);

-- Instagram session data (for automation)
CREATE TABLE IF NOT EXISTS public.instagram_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_account_id UUID REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
    session_data JSONB NOT NULL, -- Playwright storage_state (cookies + localStorage)
    session_id TEXT, -- The 'sessionid' cookie value
    csrf_token TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'expired', 'flagged'
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(instagram_account_id)
);

-- Campaigns (user's automation settings)
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    instagram_account_id UUID REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
    name TEXT DEFAULT 'My Campaign',
    status TEXT DEFAULT 'paused', -- 'active', 'paused', 'completed'
    message_template TEXT, -- Custom message or 'ai' for AI-generated
    scrape_urls TEXT[], -- Array of Instagram post URLs to scrape
    dms_per_session INTEGER DEFAULT 10,
    sessions_per_day INTEGER DEFAULT 15,
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    total_dms_sent INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads scraped for each user
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    instagram_username TEXT NOT NULL,
    full_name TEXT,
    profile_url TEXT,
    bio TEXT,
    followers_count INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    source_post_url TEXT, -- Which post they were scraped from
    dm_sent BOOLEAN DEFAULT FALSE,
    dm_sent_at TIMESTAMP WITH TIME ZONE,
    dm_sent_by UUID REFERENCES public.instagram_accounts(id), -- Which account sent the DM
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, instagram_username) -- Prevent duplicate leads per user
);

-- DM logs (audit trail)
CREATE TABLE IF NOT EXISTS public.dm_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    instagram_account_id UUID REFERENCES public.instagram_accounts(id),
    message_sent TEXT,
    status TEXT, -- 'sent', 'failed', 'blocked'
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_status_next_run ON public.campaigns(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_leads_user_dm_sent ON public.leads(user_id, dm_sent);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON public.leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dm_logs_campaign ON public.dm_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dm_logs_sent_at ON public.dm_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_user ON public.instagram_accounts(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for instagram_accounts
CREATE POLICY "Users can view own instagram accounts" ON public.instagram_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own instagram accounts" ON public.instagram_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instagram accounts" ON public.instagram_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own instagram accounts" ON public.instagram_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for instagram_sessions
CREATE POLICY "Users can manage own sessions" ON public.instagram_sessions
    FOR ALL USING (
        instagram_account_id IN (
            SELECT id FROM public.instagram_accounts WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for campaigns
CREATE POLICY "Users can view own campaigns" ON public.campaigns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaigns" ON public.campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns" ON public.campaigns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns" ON public.campaigns
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for leads
CREATE POLICY "Users can view own leads" ON public.leads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads" ON public.leads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads" ON public.leads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads" ON public.leads
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for dm_logs
CREATE POLICY "Users can view own dm logs" ON public.dm_logs
    FOR SELECT USING (
        campaign_id IN (
            SELECT id FROM public.campaigns WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own dm logs" ON public.dm_logs
    FOR INSERT WITH CHECK (
        campaign_id IN (
            SELECT id FROM public.campaigns WHERE user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to reset daily DM counters at midnight
CREATE OR REPLACE FUNCTION reset_daily_dm_counters()
RETURNS void AS $$
BEGIN
    UPDATE public.instagram_accounts
    SET dms_sent_today = 0, last_dm_reset = CURRENT_DATE
    WHERE last_dm_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile on Supabase auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Comments
COMMENT ON TABLE public.users IS 'SaaS customers - extends Supabase auth.users';
COMMENT ON TABLE public.instagram_accounts IS 'Instagram accounts connected by users for automation';
COMMENT ON TABLE public.instagram_sessions IS 'Stored session cookies and localStorage for Playwright automation';
COMMENT ON TABLE public.campaigns IS 'DM automation campaigns with settings and scheduling';
COMMENT ON TABLE public.leads IS 'Scraped Instagram users to send DMs to';
COMMENT ON TABLE public.dm_logs IS 'Audit trail of all DMs sent';
