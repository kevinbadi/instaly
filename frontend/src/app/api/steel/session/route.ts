import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

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

    // Store in database for Mac Mini worker to pick up
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: dbError } = await adminClient
      .from("steel_navigation_queue")
      .insert({
        user_id: user.id,
        steel_session_id: session.id,
        target_url: "https://www.instagram.com/accounts/login/",
        status: "pending",
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error("Failed to queue navigation:", dbError);
      // Continue anyway - return session for manual navigation fallback
    } else {
      console.log("Navigation queued for Mac Mini worker");
    }

    // Return session ID - frontend will poll for status
    const liveUrl = `https://api.steel.dev/v1/sessions/${session.id}/player?interactive=true&showControls=true`;

    return NextResponse.json({
      sessionId: session.id,
      liveViewUrl: liveUrl,
      queued: !dbError, // Tell frontend to poll if queued
    });
  } catch (error) {
    console.error("Steel session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
