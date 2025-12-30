import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRICE_TO_PLAN: Record<string, { name: string; maxAccounts: number; maxDmsPerDay: number }> = {
  [process.env.STRIPE_STARTER_PRICE_ID!]: {
    name: "starter",
    maxAccounts: 1,
    maxDmsPerDay: 200,
  },
  [process.env.STRIPE_GROWTH_PRICE_ID!]: {
    name: "growth",
    maxAccounts: 3,
    maxDmsPerDay: 600,
  },
};

async function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    console.error("No Stripe signature found");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // For testing without webhook secret, skip verification
    if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET !== "whsec_xxxxx") {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // Parse event directly for testing
      event = JSON.parse(body) as Stripe.Event;
      console.log("⚠️ Webhook signature verification skipped (no webhook secret configured)");
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`Stripe webhook received: ${event.type}`);

  const supabase = await getSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout completed:", session.id);
        
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await handleSubscriptionChange(supabase, subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabase, subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Payment failed for invoice:", invoice.id);
        // Could send email notification here
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleSubscriptionChange(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  const userId = subscription.metadata?.supabase_user_id;

  console.log("Handling subscription change:", {
    customerId,
    priceId,
    userId,
    status: subscription.status,
  });

  // Get plan details
  const planDetails = PRICE_TO_PLAN[priceId] || {
    name: "unknown",
    maxAccounts: 0,
    maxDmsPerDay: 0,
  };

  // Find user by stripe_customer_id or metadata
  let userIdToUse = userId;
  if (!userIdToUse) {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single();
    userIdToUse = user?.id;
  }

  if (!userIdToUse) {
    console.error("Could not find user for subscription:", subscription.id);
    return;
  }

  // Upsert subscription
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userIdToUse,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan_name: planDetails.name,
      status: subscription.status === "active" || subscription.status === "trialing" ? "active" : subscription.status,
      max_accounts: planDetails.maxAccounts,
      max_dms_per_day: planDetails.maxDmsPerDay,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Error upserting subscription:", error);
  } else {
    console.log(`Subscription updated for user ${userIdToUse}: ${planDetails.name}`);
  }
}

async function handleSubscriptionCanceled(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;

  // Find user by stripe_customer_id
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!user) {
    console.error("Could not find user for canceled subscription");
    return;
  }

  // Update subscription to canceled
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      max_accounts: 0,
      max_dms_per_day: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("Error updating canceled subscription:", error);
  } else {
    console.log(`Subscription canceled for user ${user.id}`);
  }
}

