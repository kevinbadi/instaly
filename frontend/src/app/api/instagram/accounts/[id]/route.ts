import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { instagram_username } = body;

    if (!instagram_username || typeof instagram_username !== "string") {
      return NextResponse.json(
        { error: "Invalid username" },
        { status: 400 }
      );
    }

    // Update the account username
    const { data, error } = await supabase
      .from("instagram_accounts")
      .update({ instagram_username: instagram_username.trim() })
      .eq("id", params.id)
      .eq("user_id", user.id) // Ensure user owns this account
      .select()
      .single();

    if (error) {
      console.error("Error updating account:", error);
      return NextResponse.json(
        { error: "Failed to update account" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ account: data });
  } catch (error) {
    console.error("Error in PATCH /api/instagram/accounts/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete the account
    const { error } = await supabase
      .from("instagram_accounts")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id); // Ensure user owns this account

    if (error) {
      console.error("Error deleting account:", error);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/instagram/accounts/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

