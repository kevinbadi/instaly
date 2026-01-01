import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getOrCreateUser } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the user's DB ID
    const dbUser = await getOrCreateUser(user.id, user.email || "", user.user_metadata?.full_name);

    // Use admin client to bypass RLS
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // First verify the account belongs to this user
    const { data: account } = await adminSupabase
      .from("instagram_accounts")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (account.user_id !== dbUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Clear dm_sent_by references in leads (set to null, keep the leads)
    const { error: leadsError } = await adminSupabase
      .from("leads")
      .update({ dm_sent_by: null })
      .eq("dm_sent_by", id);

    if (leadsError) {
      console.error("Error clearing leads dm_sent_by:", leadsError);
    }

    // Delete associated dm_logs (foreign key constraint)
    const { error: dmLogsError } = await adminSupabase
      .from("dm_logs")
      .delete()
      .eq("instagram_account_id", id);

    if (dmLogsError) {
      console.error("Error deleting dm_logs:", dmLogsError);
    }

    // Delete associated campaigns
    const { error: campaignsError } = await adminSupabase
      .from("campaigns")
      .delete()
      .eq("instagram_account_id", id);

    if (campaignsError) {
      console.error("Error deleting campaigns:", campaignsError);
    }

    // Delete associated sessions
    const { error: sessionError } = await adminSupabase
      .from("instagram_sessions")
      .delete()
      .eq("instagram_account_id", id);

    if (sessionError) {
      console.error("Error deleting sessions:", sessionError);
    }

    // Delete the account
    const { error: deleteError } = await adminSupabase
      .from("instagram_accounts")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting account:", deleteError);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    console.log(`Deleted Instagram account ${id} for user ${dbUser.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Instagram account error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { instagram_username } = body;

    if (!instagram_username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    // Get the user's DB ID
    const dbUser = await getOrCreateUser(user.id, user.email || "", user.user_metadata?.full_name);

    // Use admin client to bypass RLS
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify the account belongs to this user
    const { data: account } = await adminSupabase
      .from("instagram_accounts")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (!account || account.user_id !== dbUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the username
    const { error: updateError } = await adminSupabase
      .from("instagram_accounts")
      .update({ instagram_username })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating username:", updateError);
      return NextResponse.json({ error: "Failed to update username" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update Instagram account error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
