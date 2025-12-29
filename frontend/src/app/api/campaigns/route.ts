import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser, getCampaigns, createCampaign } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(user.id, user.email!, user.user_metadata?.full_name);
    const campaigns = await getCampaigns(dbUser.id);

    // Get leads count for each campaign
    const campaignsWithLeads = await Promise.all(
      campaigns.map(async (campaign) => {
        const { data } = await supabase
          .from("leads")
          .select("id")
          .eq("campaign_id", campaign.id);
        
        return {
          ...campaign,
          leads_count: data?.length || 0,
        };
      })
    );

    return NextResponse.json({ campaigns: campaignsWithLeads });
  } catch (error) {
    console.error("Campaigns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      name, 
      instagram_account_id, 
      message_template, 
      scrape_urls,
      dms_per_session = 10,
      sessions_per_day = 15,
    } = body;

    if (!name || !instagram_account_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const dbUser = await getOrCreateUser(user.id, user.email!, user.user_metadata?.full_name);

    const campaign = await createCampaign(
      dbUser.id,
      instagram_account_id,
      name,
      message_template || null,
      scrape_urls || [],
      dms_per_session,
      sessions_per_day
    );

    // Get the Instagram username for the response
    const { data: account } = await supabase
      .from("instagram_accounts")
      .select("instagram_username")
      .eq("id", instagram_account_id)
      .single();

    return NextResponse.json({
      campaign: {
        ...campaign,
        instagram_username: account?.instagram_username,
        leads_count: 0,
      },
    });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
