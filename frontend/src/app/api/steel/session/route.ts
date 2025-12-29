import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Create Steel session with Instagram as the start URL
    console.log("Creating Steel session with Instagram start URL...");
    const sessionResponse = await fetch("https://api.steel.dev/v1/sessions", {
      method: "POST",
      headers: {
        "Steel-Api-Key": STEEL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionTimeout: 600000, // 10 minutes
        startUrl: "https://www.instagram.com/accounts/login/",
      }),
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.json();
      console.error("Failed to create session:", error);
      return NextResponse.json({ error: error.message || "Failed to create session" }, { status: 500 });
    }

    const session = await sessionResponse.json();
    console.log("Steel session created:", session.id);

    // Give the browser a moment to load the page
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Return the player URL
    const liveUrl = `https://api.steel.dev/v1/sessions/${session.id}/player?interactive=true&showControls=true`;
    console.log("Live URL:", liveUrl);

    return NextResponse.json({
      sessionId: session.id,
      liveViewUrl: liveUrl,
    });
  } catch (error) {
    console.error("Steel session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
