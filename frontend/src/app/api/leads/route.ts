import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser, getLeads } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const campaignId = searchParams.get("campaign_id");
    const dmSent = searchParams.get("dm_sent");

    const dbUser = await getOrCreateUser(user.id, user.email!, user.user_metadata?.full_name);

    const leads = await getLeads(
      dbUser.id,
      campaignId || undefined,
      dmSent ? dmSent === "true" : undefined
    );

    // Add campaign name to each lead
    const leadsWithCampaign = await Promise.all(
      leads.map(async (lead) => {
        if (lead.campaign_id) {
          const { data: campaign } = await supabase
            .from("campaigns")
            .select("name")
            .eq("id", lead.campaign_id)
            .single();
          
          return {
            ...lead,
            campaign_name: campaign?.name || "Unknown",
          };
        }
        return { ...lead, campaign_name: null };
      })
    );

    return NextResponse.json({ leads: leadsWithCampaign });
  } catch (error) {
    console.error("Leads error:", error);
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
    const { leads, campaign_id } = body;

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json(
        { error: "Invalid leads data" },
        { status: 400 }
      );
    }

    const dbUser = await getOrCreateUser(user.id, user.email!, user.user_metadata?.full_name);

    // Insert leads
    let insertedCount = 0;
    for (const lead of leads) {
      const { error } = await supabase
        .from("leads")
        .upsert(
          {
            user_id: dbUser.id,
            campaign_id: campaign_id || null,
            instagram_username: lead.instagram_username,
            full_name: lead.full_name || null,
            profile_url: lead.profile_url || null,
            bio: lead.bio || null,
            followers_count: lead.followers_count || null,
          },
          { onConflict: "user_id,instagram_username", ignoreDuplicates: true }
        );
      
      if (!error) insertedCount++;
    }

    return NextResponse.json({
      success: true,
      inserted: insertedCount,
    });
  } catch (error) {
    console.error("Create leads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
