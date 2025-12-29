import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(user.id, user.email!, user.user_metadata?.full_name);

    // Get total leads
    const { data: totalData } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", dbUser.id);

    // Get unassigned leads (no campaign)
    const { data: unassignedData } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", dbUser.id)
      .is("campaign_id", null)
      .eq("dm_sent", false);

    // Get pending leads (assigned but not sent)
    const { data: pendingData } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", dbUser.id)
      .not("campaign_id", "is", null)
      .eq("dm_sent", false);

    return NextResponse.json({
      total: totalData?.length || 0,
      unassigned: unassignedData?.length || 0,
      pending: pendingData?.length || 0,
    });
  } catch (error) {
    console.error("Lead stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

