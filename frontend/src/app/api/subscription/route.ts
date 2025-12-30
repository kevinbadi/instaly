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

    // Use admin client to bypass RLS
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get subscription from subscriptions table
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
          status: "inactive",
          tier: "free",
          currentPeriodEnd: null,
        },
      });
    }

    // Map the subscriptions table format to the expected format
    return NextResponse.json({
      subscription: {
        status: subscription.status,
        tier: subscription.plan_name,
        currentPeriodEnd: subscription.current_period_end,
        maxAccounts: subscription.max_accounts,
        maxDmsPerDay: subscription.max_dms_per_day,
      },
    });
  } catch (error) {
    console.error("Subscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
