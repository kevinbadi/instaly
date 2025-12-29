import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Use service role key for webhook (no auth context)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;

        if (userId && tier) {
          await supabaseAdmin
            .from("users")
            .update({
              subscription_status: "active",
              subscription_tier: tier,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get user by Stripe customer ID
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          const status = subscription.status === "active" ? "active" : "inactive";
          
          // Determine tier from price
          const priceId = subscription.items.data[0]?.price.id;
          let tier = "starter";
          if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) tier = "growth";
          if (priceId === process.env.STRIPE_SCALE_PRICE_ID) tier = "scale";

          await supabaseAdmin
            .from("users")
            .update({
              subscription_status: status,
              subscription_tier: tier,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: user } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabaseAdmin
            .from("users")
            .update({
              subscription_status: "cancelled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: user } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          console.log(`Payment failed for user ${user.id}`);
          // Could send an email notification here
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
