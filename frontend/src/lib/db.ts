import { createClient } from "@/lib/supabase/server";

// Type definitions for database models
export interface User {
  id: string;
  email: string;
  name: string | null;
  stripe_customer_id: string | null;
  subscription_status: "active" | "inactive" | "cancelled";
  subscription_tier: "starter" | "growth" | "scale";
  created_at: string;
  updated_at: string;
}

export interface InstagramAccount {
  id: string;
  user_id: string;
  instagram_username: string;
  status: "active" | "needs_reauth" | "disabled";
  daily_dm_limit: number;
  dms_sent_today: number;
  last_dm_reset: string;
  created_at: string;
}

export interface InstagramSession {
  id: string;
  instagram_account_id: string;
  session_data: Record<string, unknown>;
  session_id: string | null;
  csrf_token: string | null;
  status: "active" | "expired" | "flagged";
  captured_at: string;
  last_used_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  campaign_id: string | null;
  instagram_username: string;
  full_name: string | null;
  profile_url: string | null;
  bio: string | null;
  followers_count: number | null;
  is_verified: boolean;
  source_post_url: string | null;
  dm_sent: boolean;
  dm_sent_at: string | null;
  dm_sent_by: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  instagram_account_id: string;
  name: string;
  status: "active" | "paused" | "completed";
  message_template: string | null;
  scrape_urls: string[];
  dms_per_session: number;
  sessions_per_day: number;
  next_run_at: string | null;
  last_run_at: string | null;
  total_dms_sent: number;
  created_at: string;
  updated_at: string;
}

export interface DmLog {
  id: string;
  campaign_id: string;
  lead_id: string;
  instagram_account_id: string;
  message_sent: string;
  status: "sent" | "failed" | "blocked";
  error_message: string | null;
  sent_at: string;
}

// Database helper functions
export async function getOrCreateUser(authUserId: string, email: string, name?: string): Promise<User> {
  // Use service role client for user creation to bypass RLS
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase config:", { 
      hasUrl: !!supabaseUrl, 
      hasServiceKey: !!serviceRoleKey 
    });
    throw new Error("Supabase not configured");
  }
  
  const supabase = createAdminClient(supabaseUrl, serviceRoleKey);
  
  // First, try to get existing user
  const { data: existingUser, error: selectError } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUserId)
    .single();
  
  if (selectError && selectError.code !== 'PGRST116') {
    // PGRST116 = row not found, which is expected
    console.error("Error fetching user:", selectError);
  }
  
  if (existingUser) {
    return existingUser as User;
  }
  
  console.log("Creating new user:", authUserId, email);
  
  // Create new user if doesn't exist
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      id: authUserId, // Use Supabase Auth user ID
      email,
      name: name || null,
    })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating user:", error);
    throw error;
  }
  
  console.log("User created successfully:", newUser?.id);
  return newUser as User;
}

export async function getUserById(id: string): Promise<User | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();
  
  return data as User | null;
}

export async function updateUserStripeCustomer(
  userId: string,
  stripeCustomerId: string
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from("users")
    .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function updateUserSubscription(
  userId: string,
  status: string,
  tier: string
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from("users")
    .update({ 
      subscription_status: status, 
      subscription_tier: tier, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", userId);
}

export async function getInstagramAccounts(userId: string): Promise<InstagramAccount[]> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from("instagram_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  
  return (data || []) as InstagramAccount[];
}

export async function getInstagramAccountById(id: string): Promise<InstagramAccount | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from("instagram_accounts")
    .select("*")
    .eq("id", id)
    .single();
  
  return data as InstagramAccount | null;
}

export async function createInstagramAccount(
  userId: string,
  username: string
): Promise<InstagramAccount> {
  const supabase = await createClient();
  
  // Upsert - create or update if exists
  const { data, error } = await supabase
    .from("instagram_accounts")
    .upsert(
      { 
        user_id: userId, 
        instagram_username: username,
        status: "active"
      },
      { onConflict: "user_id,instagram_username" }
    )
    .select()
    .single();
  
  if (error) throw error;
  return data as InstagramAccount;
}

export async function saveInstagramSession(
  accountId: string,
  sessionData: Record<string, unknown>,
  sessionId?: string,
  csrfToken?: string
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from("instagram_sessions")
    .upsert(
      {
        instagram_account_id: accountId,
        session_data: sessionData,
        session_id: sessionId || null,
        csrf_token: csrfToken || null,
        status: "active",
        captured_at: new Date().toISOString(),
      },
      { onConflict: "instagram_account_id" }
    );
}

export async function getCampaigns(userId: string): Promise<(Campaign & { instagram_username?: string })[]> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from("campaigns")
    .select(`
      *,
      instagram_accounts (instagram_username)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  
  return (data || []).map((c: any) => ({
    ...c,
    instagram_username: c.instagram_accounts?.instagram_username,
  }));
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from("campaigns")
    .select(`
      *,
      instagram_accounts (instagram_username)
    `)
    .eq("id", id)
    .single();
  
  return data as Campaign | null;
}

export async function createCampaign(
  userId: string,
  instagramAccountId: string,
  name: string,
  messageTemplate: string | null,
  scrapeUrls: string[],
  dmsPerSession: number = 10,
  sessionsPerDay: number = 15
): Promise<Campaign> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      user_id: userId,
      instagram_account_id: instagramAccountId,
      name,
      message_template: messageTemplate,
      scrape_urls: scrapeUrls,
      dms_per_session: dmsPerSession,
      sessions_per_day: sessionsPerDay,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as Campaign;
}

export async function updateCampaignStatus(
  campaignId: string,
  status: "active" | "paused" | "completed"
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from("campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
}

export async function getLeads(
  userId: string,
  campaignId?: string,
  dmSent?: boolean
): Promise<Lead[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  
  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }
  
  if (dmSent !== undefined) {
    query = query.eq("dm_sent", dmSent);
  }
  
  const { data } = await query;
  return (data || []) as Lead[];
}

export async function getLeadStats(userId: string): Promise<{
  total: number;
  messaged: number;
  pending: number;
}> {
  const supabase = await createClient();
  
  const { data: totalData } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", userId);
  
  const { data: messagedData } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", userId)
    .eq("dm_sent", true);
  
  const total = totalData?.length || 0;
  const messaged = messagedData?.length || 0;
  
  return {
    total,
    messaged,
    pending: total - messaged,
  };
}

export async function getDmsSentToday(userId: string): Promise<number> {
  const supabase = await createClient();
  
  // Use last 24 hours instead of calendar day to be more user-friendly
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  // First get all instagram account IDs for this user
  const { data: accounts } = await supabase
    .from("instagram_accounts")
    .select("id")
    .eq("user_id", userId);
  
  if (!accounts || accounts.length === 0) {
    return 0;
  }
  
  const accountIds = accounts.map(a => a.id);
  
  // Count actual DMs sent in last 24 hours from dm_logs for these accounts
  const { data, error } = await supabase
    .from("dm_logs")
    .select("id")
    .in("instagram_account_id", accountIds)
    .eq("status", "sent")
    .gte("sent_at", twentyFourHoursAgo.toISOString());
  
  if (error) {
    console.error("Error fetching DMs sent today:", error);
    // Fallback to instagram_accounts dms_sent_today
    const { data: fallbackData } = await supabase
      .from("instagram_accounts")
      .select("dms_sent_today")
      .eq("user_id", userId);
    
    return (fallbackData || []).reduce((sum, acc) => sum + (acc.dms_sent_today || 0), 0);
  }
  
  return data?.length || 0;
}
