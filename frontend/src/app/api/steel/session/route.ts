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

    // Create Steel session with startUrl
    console.log("Creating Steel session with startUrl...");
    const sessionResponse = await fetch("https://api.steel.dev/v1/sessions", {
      method: "POST",
      headers: {
        "Steel-Api-Key": STEEL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionTimeout: 600000, // 10 minutes
        startUrl: "https://www.instagram.com/accounts/login/",
        useProxy: true,
        blockAds: true,
      }),
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.json();
      console.error("Failed to create session:", error);
      return NextResponse.json({ error: error.message || "Failed to create session" }, { status: 500 });
    }

    const session = await sessionResponse.json();
    console.log("Steel session created:", JSON.stringify(session));

    // Log full session response for debugging
    console.log("Full session response:", JSON.stringify(session, null, 2));

    // Get the session viewer URL from the response
    // Steel might return different URL fields
    const sessionViewerUrl = session.sessionViewerUrl || session.liveUrl || session.viewerUrl ||
                             `https://api.steel.dev/v1/sessions/${session.id}/player?interactive=true&showControls=true`;
    
    // Also construct a URL with the target page encoded
    const playerWithUrl = `https://api.steel.dev/v1/sessions/${session.id}/player?interactive=true&showControls=true&url=${encodeURIComponent("https://www.instagram.com/accounts/login/")}`;
    
    console.log("Session viewer URL:", sessionViewerUrl);
    console.log("Player with URL:", playerWithUrl);

    return NextResponse.json({
      sessionId: session.id,
      liveViewUrl: playerWithUrl, // Try with URL parameter
      debugUrl: session.debugUrl,
      wsEndpoint: session.websocketUrl || `wss://connect.steel.dev?sessionId=${session.id}&apiKey=${STEEL_API_KEY}`,
    });
  } catch (error) {
    console.error("Steel session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
