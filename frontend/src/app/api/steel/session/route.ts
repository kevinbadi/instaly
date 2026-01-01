import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spawn } from "child_process";
import path from "path";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STEEL_API_KEY = process.env.STEEL_API_KEY;

async function navigateWithScript(sessionId: string, apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Path to the navigation script (runs puppeteer outside of webpack)
      const scriptPath = path.join(process.cwd(), "scripts", "navigate-steel.js");
      
      console.log("Running navigation script:", scriptPath);
      
      const child = spawn("node", [scriptPath, sessionId, apiKey], {
        timeout: 45000,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        console.log("Navigation script:", data.toString().trim());
      });

      child.on("close", (code) => {
        console.log("Navigation script exited with code:", code);
        if (stderr) {
          console.log("Navigation stderr:", stderr);
        }
        
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result.success === true);
        } catch {
          resolve(code === 0);
        }
      });

      child.on("error", (err) => {
        console.error("Navigation script error:", err);
        resolve(false);
      });

    } catch (error) {
      console.error("Failed to spawn navigation script:", error);
      resolve(false);
    }
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

    // Navigate to Instagram using external script (avoids webpack/serverless issues)
    console.log("Navigating to Instagram...");
    const navSuccess = await navigateWithScript(session.id, STEEL_API_KEY);
    
    if (navSuccess) {
      console.log("Instagram loaded successfully!");
    } else {
      console.log("Navigation failed, user can navigate manually");
    }

    // Return session ID with live view URL
    const liveUrl = `${session.debugUrl}?interactive=true&showControls=true`;

    return NextResponse.json({
      sessionId: session.id,
      liveViewUrl: liveUrl,
      navigated: navSuccess,
    });
  } catch (error) {
    console.error("Steel session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
