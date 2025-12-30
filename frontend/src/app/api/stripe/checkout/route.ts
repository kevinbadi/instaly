import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  console.log("=== CHECKOUT API CALLED ===");
  
  try {
    // Check env vars
    console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT SET");
    console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT SET");
    console.log("STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY ? "SET" : "NOT SET");
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Auth error: " + authError.message }, { status: 401 });
    }

    if (!user) {
      console.error("No user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("User authenticated:", user.id, user.email);

    const { priceId } = await request.json();
    console.log("Price ID:", priceId);

    if (!priceId) {
      return NextResponse.json({ error: "Price ID required" }, { status: 400 });
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // First, ensure user exists in users table
    console.log("Checking if user exists in DB...");
    let { data: dbUser, error: fetchError } = await adminClient
      .from("users")
      .select("id, email, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error fetching user:", fetchError);
    }

    console.log("DB user found:", dbUser ? "YES" : "NO");

    // If user doesn't exist, create them
    if (!dbUser) {
      console.log("Creating user in database:", user.id, user.email);
      const { data: newUser, error: createError } = await adminClient
        .from("users")
        .insert({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || null,
        })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create user:", createError);
        return NextResponse.json({ error: "Failed to create user: " + createError.message }, { status: 500 });
      }
      console.log("User created:", newUser);
      dbUser = newUser;
    }

    let customerId = dbUser?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      console.log("Creating Stripe customer for:", user.email);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to database
      await adminClient
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Create checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://instaly-2.vercel.app";
    console.log("Creating checkout session with success URL:", `${appUrl}/dashboard?checkout=success`);
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=canceled`,
      allow_promotion_codes: true, // Enable discount/promo code field
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
