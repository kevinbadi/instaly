import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STEEL_API_KEY = process.env.STEEL_API_KEY;

export async function POST() {
  console.log("Steel session POST called");

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!STEEL_API_KEY) {
      return NextResponse.json({ error: "Steel API key not configured" }, { status: 500 });
    }

    // Create Steel session
    console.log("Creating Steel session...");
    const sessionResponse = await fetch("https://api.steel.dev/v1/sessions", {
      method: "POST",
      headers: {
        "Steel-Api-Key": STEEL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionTimeout: 600000, // 10 minutes
      }),
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.json();
      console.error("Failed to create session:", error);
      return NextResponse.json({ error: error.message || "Failed to create session" }, { status: 500 });
    }

    const session = await sessionResponse.json();
    console.log("Steel session created:", session.id);

    // Use admin client to insert into navigation queue (bypasses RLS)
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Queue the navigation task for Mac Mini worker
    const targetUrl = "https://www.instagram.com/";
    console.log("Queueing navigation task for Mac Mini worker...");
    
    const { error: queueError } = await adminClient
      .from("steel_navigation_queue")
      .insert({
        user_id: user.id,
        steel_session_id: session.id,
        target_url: targetUrl,
        status: "pending",
      });

    if (queueError) {
      console.error("Failed to queue navigation task:", queueError);
      // Don't fail the request - the browser will still work, user just has to navigate manually
    } else {
      console.log("Navigation task queued successfully");
    }

    // Return session ID with live view URL
    const liveUrl = `${session.debugUrl}?interactive=true&showControls=true`;

    return NextResponse.json({
      sessionId: session.id,
      liveViewUrl: liveUrl,
      // Tell frontend navigation is queued for Mac Mini worker
      queued: !queueError,
      // Include target URL so frontend can show instructions if needed
      targetUrl,
    });
  } catch (error) {
    console.error("Steel session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
