import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Try to navigate using WebSocket CDP
    let navigated = false;
    try {
      navigated = await navigateWithCDP(session.websocketUrl, STEEL_API_KEY);
    } catch (navError) {
      console.log("Navigation error (non-fatal):", navError);
    }

    // Return session ID with live view URL
    const liveUrl = `${session.debugUrl}?interactive=true&showControls=true`;

    return NextResponse.json({
      sessionId: session.id,
      liveViewUrl: liveUrl,
      navigated,
      // Include target URL so frontend can navigate if needed
      targetUrl: "https://www.instagram.com/",
    });
  } catch (error) {
    console.error("Steel session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function navigateWithCDP(websocketUrl: string, apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log("CDP navigation timeout");
      resolve(false);
    }, 20000);

    try {
      const wsUrl = `${websocketUrl}&apiKey=${apiKey}`;
      console.log("Connecting to Steel CDP...");
      
      // Use global WebSocket (available in Node 18+)
      const ws = new WebSocket(wsUrl);
      
      let messageId = 1;
      let attached = false;

      ws.onopen = () => {
        console.log("WebSocket connected, getting targets...");
        ws.send(JSON.stringify({
          id: messageId++,
          method: "Target.getTargets",
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          
          // Handle getTargets response
          if (msg.result?.targetInfos && !attached) {
            const pageTarget = msg.result.targetInfos.find((t: any) => t.type === "page");
            if (pageTarget) {
              console.log("Found page target, attaching...");
              attached = true;
              ws.send(JSON.stringify({
                id: messageId++,
                method: "Target.attachToTarget",
                params: { targetId: pageTarget.targetId, flatten: true }
              }));
            }
          }
          
          // Handle attachToTarget response
          if (msg.result?.sessionId) {
            console.log("Attached, navigating to Instagram...");
            ws.send(JSON.stringify({
              id: messageId++,
              method: "Page.navigate",
              params: { url: "https://www.instagram.com/" },
              sessionId: msg.result.sessionId
            }));
          }
          
          // Handle navigation response
          if (msg.result?.frameId) {
            console.log("Navigation started!");
            clearTimeout(timeout);
            setTimeout(() => {
              ws.close();
              resolve(true);
            }, 2000);
          }
          
          if (msg.error) {
            console.log("CDP error:", msg.error);
          }
        } catch (parseErr) {
          console.log("Parse error:", parseErr);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        clearTimeout(timeout);
        resolve(false);
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
      };

    } catch (error) {
      console.error("CDP connection error:", error);
      clearTimeout(timeout);
      resolve(false);
    }
  });
}
