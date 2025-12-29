import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tier } = await request.json();

    // For testing: Just update the user's subscription directly
    const dbUser = await getOrCreateUser(user.id, user.email!, user.user_metadata?.full_name);

    await supabase
      .from("users")
      .update({
        subscription_status: "active",
        subscription_tier: tier || "starter",
        updated_at: new Date().toISOString(),
      })
      .eq("id", dbUser.id);

    // Redirect back to dashboard
    return NextResponse.json({ 
      url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?success=true` 
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
