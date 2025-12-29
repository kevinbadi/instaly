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

    // Try to extract username from localStorage
    let username = "instagram_user";
    
    console.log("Extracting username from localStorage...");
    console.log("localStorage keys:", localStorage ? Object.keys(localStorage) : "none");
    
    if (localStorage) {
      try {
        // Username is in one_tap_storage_version field
        const oneTapStorage = localStorage["one_tap_storage_version"];
        if (oneTapStorage) {
          console.log("Found one_tap_storage_version:", oneTapStorage);
          const parsed = typeof oneTapStorage === "string" ? JSON.parse(oneTapStorage) : oneTapStorage;
          // The structure is { "userId": { "username": "actual_username", ... } }
          const userIds = Object.keys(parsed);
          if (userIds.length > 0) {
            const userData = parsed[userIds[0]];
            if (userData?.username) {
              username = userData.username;
              console.log("Extracted username:", username);
            }
          }
        }
      } catch (e) {
        console.error("Error parsing one_tap_storage_version:", e);
      }
      
      // Fallback: try ds_user_id cookie to get user ID, then look it up
      if (username === "instagram_user") {
        const dsUserIdCookie = cookies?.find((c: any) => c.name === "ds_user_id")?.value;
        if (dsUserIdCookie) {
          console.log("Found ds_user_id:", dsUserIdCookie);
          // We have the user ID but not username - could make an API call here
          // For now, use ds_user_id as a fallback identifier
        }
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
