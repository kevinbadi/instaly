import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser, createInstagramAccount, saveInstagramSession } from "@/lib/db";

export const dynamic = 'force-dynamic';

const STEEL_API_KEY = process.env.STEEL_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    if (!STEEL_API_KEY) {
      return NextResponse.json(
        { error: "Steel API key not configured" },
        { status: 500 }
      );
    }

    // Get session context (cookies and localStorage)
    const contextResponse = await fetch(
      `https://api.steel.dev/v1/sessions/${sessionId}/context`,
      {
        headers: {
          "Steel-Api-Key": STEEL_API_KEY,
        },
      }
    );

    if (!contextResponse.ok) {
      return NextResponse.json(
        { error: "Failed to capture session context" },
        { status: 500 }
      );
    }

    const context = await contextResponse.json();
    const { cookies, localStorage } = context;

    // DEBUG: Log full context
    console.log("=== STEEL CONTEXT DEBUG ===");
    console.log("Full context keys:", Object.keys(context));
    console.log("Cookies count:", cookies?.length || 0);
    console.log("localStorage keys:", localStorage ? Object.keys(localStorage) : "none");
    
    // Log all cookies
    console.log("\n=== ALL COOKIES ===");
    cookies?.forEach((c: any) => {
      console.log(`  ${c.name}: ${c.value?.substring(0, 50)}...`);
    });
    
    // Log all localStorage
    console.log("\n=== ALL LOCALSTORAGE ===");
    if (localStorage) {
      Object.entries(localStorage).forEach(([key, value]) => {
        const valStr = typeof value === 'string' ? value : JSON.stringify(value);
        console.log(`  ${key}: ${valStr?.substring(0, 100)}...`);
      });
    }
    console.log("=== END DEBUG ===\n");

    // Find session cookie and csrf token
    const sessionCookie = cookies?.find(
      (c: any) => c.name === "sessionid"
    )?.value;
    const csrfToken = cookies?.find(
      (c: any) => c.name === "csrftoken"
    )?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Not logged in. Please complete the Instagram login." },
        { status: 400 }
      );
    }

    // Try to extract username from various sources
    let username = "instagram_user";
    
    // Method 1: ds_user_id cookie + API call to get username
    const dsUserIdCookie = cookies?.find((c: any) => c.name === "ds_user_id")?.value;
    console.log("ds_user_id cookie:", dsUserIdCookie);
    
    // Method 2: Check localStorage for username
    if (localStorage) {
      // Try various localStorage keys where Instagram might store username
      const keysToTry = [
        "one_tap_storage_version",
        "wwwData",
        "fb_local_storage",
        "webPushData",
        "idb-heartbeat-timestamp"
      ];
      
      for (const key of keysToTry) {
        const val = localStorage[key];
        if (val) {
          console.log(`Checking ${key}:`, typeof val === 'string' ? val.substring(0, 200) : JSON.stringify(val).substring(0, 200));
          
          try {
            const parsed = typeof val === "string" ? JSON.parse(val) : val;
            
            // Look for username in various structures
            if (parsed?.username) {
              username = parsed.username;
              console.log(`Found username in ${key}:`, username);
              break;
            }
            
            // Check nested objects
            if (typeof parsed === 'object') {
              const jsonStr = JSON.stringify(parsed);
              // Look for username pattern in the JSON
              const usernameMatch = jsonStr.match(/"username"\s*:\s*"([^"]+)"/);
              if (usernameMatch && usernameMatch[1]) {
                username = usernameMatch[1];
                console.log(`Found username via regex in ${key}:`, username);
                break;
              }
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
    }
    
    // Method 3: If still no username, try to fetch from Instagram API using session
    if (username === "instagram_user" && dsUserIdCookie) {
      console.log("Attempting to fetch username from Instagram API...");
      try {
        const igResponse = await fetch(`https://i.instagram.com/api/v1/users/${dsUserIdCookie}/info/`, {
          headers: {
            "Cookie": `sessionid=${sessionCookie}; ds_user_id=${dsUserIdCookie}`,
            "User-Agent": "Instagram 76.0.0.15.395 Android (24/7.0; 640dpi; 1440x2560; samsung; SM-G930F; herolte; samsungexynos8890; en_US; 138226743)",
          },
        });
        
        if (igResponse.ok) {
          const igData = await igResponse.json();
          console.log("Instagram API response:", JSON.stringify(igData).substring(0, 500));
          if (igData?.user?.username) {
            username = igData.user.username;
            console.log("Got username from Instagram API:", username);
          }
        } else {
          console.log("Instagram API failed:", igResponse.status);
        }
      } catch (e) {
        console.error("Error fetching from Instagram API:", e);
      }
    }
    
    console.log("Final username:", username);

    // Format storage state for Playwright
    const storageState = {
      cookies: cookies || [],
      origins: [
        {
          origin: "https://www.instagram.com",
          localStorage: localStorage
            ? Object.entries(localStorage).map(([name, value]) => ({
                name,
                value: typeof value === "string" ? value : JSON.stringify(value),
              }))
            : [],
        },
      ],
    };

    // Get or create user in database
    const dbUser = await getOrCreateUser(
      user.id,
      user.email!,
      user.user_metadata?.full_name
    );

    // Create or update Instagram account
    const account = await createInstagramAccount(dbUser.id, username);

    // Save session data
    await saveInstagramSession(
      account.id,
      storageState,
      sessionCookie,
      csrfToken
    );

    // Release the Steel session
    await fetch(`https://api.steel.dev/v1/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        "Steel-Api-Key": STEEL_API_KEY,
      },
    });

    return NextResponse.json({
      success: true,
      username: account.instagram_username,
      accountId: account.id,
    });
  } catch (error) {
    console.error("Capture session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
