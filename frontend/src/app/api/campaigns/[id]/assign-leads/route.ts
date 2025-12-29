import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const { leadIds, assignAll } = body;

    // Verify campaign exists and belongs to user
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*, users!inner(id)")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Get user record
    const { data: dbUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let updated = 0;

    if (assignAll) {
      // Assign all unassigned, unsent leads to this campaign
      const { data } = await supabase
        .from("leads")
        .update({ campaign_id: campaignId })
        .eq("user_id", dbUser.id)
        .is("campaign_id", null)
        .eq("dm_sent", false)
        .select("id");
      
      updated = data?.length || 0;
    } else if (leadIds && Array.isArray(leadIds)) {
      // Assign specific leads
      const { data } = await supabase
        .from("leads")
        .update({ campaign_id: campaignId })
        .eq("user_id", dbUser.id)
        .in("id", leadIds)
        .select("id");
      
      updated = data?.length || 0;
    }

    return NextResponse.json({
      success: true,
      leadsAssigned: updated,
    });
  } catch (error) {
    console.error("Assign leads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

