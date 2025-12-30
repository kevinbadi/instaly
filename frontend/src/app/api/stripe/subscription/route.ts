import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get subscription from database
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: subscription, error } = await adminClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching subscription:", error);
      return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
    }

    // Return free tier if no subscription
    if (!subscription) {
      return NextResponse.json({
        subscription: {
          plan_name: "free",
          status: "inactive",
          max_accounts: 0,
          max_dms_per_day: 0,
        },
      });
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("Subscription fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

