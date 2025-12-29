import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spawn } from "child_process";
import path from "path";

const STEEL_API_KEY = process.env.STEEL_API_KEY;

function runNavigationScript(sessionId: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), "scripts", "navigate-steel.js");
    const child = spawn("node", [scriptPath, sessionId, apiKey], {
      timeout: 45000,
    });

    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      console.log("Script:", data.toString().trim());
    });

    child.on("close", (code) => {
      try {
        const result = JSON.parse(output.trim());
        resolve(result);
      } catch {
        resolve({ success: code === 0, error: output || "Script failed" });
      }
    });

    child.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

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

    // Wait for browser to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Run navigation script as subprocess (bypasses webpack)
    console.log("Running navigation script...");
    const navResult = await runNavigationScript(session.id, STEEL_API_KEY);
    console.log("Navigation result:", navResult);

    // Return the player URL regardless of navigation result
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
