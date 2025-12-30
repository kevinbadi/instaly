import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

// Helper to get plan details from price ID
function getPlanDetails(priceId: string): { name: string; maxAccounts: number; maxDmsPerDay: number } {
  const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID;
  const growthPriceId = process.env.STRIPE_GROWTH_PRICE_ID;
  
  console.log("Looking up price:", priceId);
  console.log("Starter price ID:", starterPriceId);
  console.log("Growth price ID:", growthPriceId);
  
  if (priceId === starterPriceId) {
    return { name: "starter", maxAccounts: 1, maxDmsPerDay: 200 };
  }
  if (priceId === growthPriceId) {
    return { name: "growth", maxAccounts: 3, maxDmsPerDay: 600 };
  }
  
  console.warn("Unknown price ID:", priceId);
  return { name: "unknown", maxAccounts: 0, maxDmsPerDay: 0 };
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(request: NextRequest) {
  console.log("=== STRIPE WEBHOOK RECEIVED ===");
  
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  console.log("Signature present:", !!signature);
  console.log("Webhook secret configured:", !!process.env.STRIPE_WEBHOOK_SECRET);

  if (!signature) {
    console.error("No Stripe signature found");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    // Verify webhook signature
    if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET !== "whsec_xxxxx") {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log("✅ Webhook signature verified");
    } else {
      // Parse event directly for testing
      event = JSON.parse(body) as Stripe.Event;
      console.log("⚠️ Webhook signature verification skipped (no webhook secret configured)");
    }
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature: " + err.message }, { status: 400 });
  }

  console.log(`Stripe webhook event type: ${event.type}`);

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout completed:", session.id);
        console.log("Subscription ID:", session.subscription);
        console.log("Customer ID:", session.customer);
        console.log("Metadata:", session.metadata);
        
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
  const planDetails = getPlanDetails(priceId);

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

