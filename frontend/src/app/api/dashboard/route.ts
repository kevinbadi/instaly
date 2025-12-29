import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser, getDmsSentToday, getLeadStats, getCampaigns } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create user in our database
    const dbUser = await getOrCreateUser(
      user.id,
      user.email!,
      user.user_metadata?.full_name
    );

    // Get stats
    const dmsSentToday = await getDmsSentToday(dbUser.id);
    const leadStats = await getLeadStats(dbUser.id);
    const campaigns = await getCampaigns(dbUser.id);

    // Get daily limit based on subscription tier
    const dailyLimits: Record<string, number> = {
      starter: 200,
      growth: 500,
      scale: 1000,
    };
    const dailyLimit = dailyLimits[dbUser.subscription_tier] || 200;

    // Get active campaigns count
    const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

    // Get recent DMs
    const { data: recentDms } = await supabase
      .from("dm_logs")
      .select(`
        id,
        message_sent,
        sent_at,
        status,
        leads (instagram_username)
      `)
      .order("sent_at", { ascending: false })
      .limit(10);

    // Calculate response rate (placeholder)
    const responseRate = 23;

    return NextResponse.json({
      stats: {
        dmsSentToday,
        dailyLimit,
        totalLeads: leadStats.total,
        messagedLeads: leadStats.messaged,
        activeCampaigns,
        responseRate,
      },
      campaigns: campaigns.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        instagram_username: c.instagram_username,
        total_dms_sent: c.total_dms_sent,
        leads_count: 0,
      })),
      recentDms: (recentDms || []).map((dm: any) => ({
        id: dm.id,
        lead_username: dm.leads?.instagram_username || "unknown",
        message_preview: dm.message_sent?.slice(0, 100),
        sent_at: dm.sent_at,
        status: dm.status,
      })),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
