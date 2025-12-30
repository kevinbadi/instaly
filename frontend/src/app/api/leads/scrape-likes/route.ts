import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

export async function POST(request: NextRequest) {
  console.log("=== SCRAPE LIKES API CALLED ===");

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postUrls, instagramAccountId } = await request.json();

    if (!postUrls || !Array.isArray(postUrls) || postUrls.length === 0) {
      return NextResponse.json({ error: "Post URLs required" }, { status: 400 });
    }

    if (!instagramAccountId) {
      return NextResponse.json({ error: "Instagram account ID required" }, { status: 400 });
    }

    // Get the Instagram session for this account
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify the Instagram account belongs to this user
    const { data: instagramAccount, error: accountError } = await adminClient
      .from("instagram_accounts")
      .select("id, instagram_username, user_id")
      .eq("id", instagramAccountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !instagramAccount) {
      return NextResponse.json({ error: "Instagram account not found" }, { status: 404 });
    }

    // Get the session for this Instagram account
    const { data: session, error: sessionError } = await adminClient
      .from("instagram_sessions")
      .select("session_id, csrf_token, status")
      .eq("instagram_account_id", instagramAccountId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "No active Instagram session found. Please reconnect your account." }, { status: 404 });
    }

    if (session.status !== "active") {
      return NextResponse.json({ error: "Instagram session expired. Please reconnect your account." }, { status: 401 });
    }

    console.log(`Using session for @${instagramAccount.instagram_username}`);
    console.log(`Scraping ${postUrls.length} post(s)...`);

    // Call Apify API with the Instagram session cookie
    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/clothefobia~instagram-post-like-user-extractor/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookies: `[${session.session_id}]`,
          proxy: {
            useApifyProxy: true,
          },
          urls: postUrls,
        }),
      }
    );

    if (!apifyResponse.ok) {
      const error = await apifyResponse.text();
      console.error("Apify API error:", error);
      return NextResponse.json({ error: "Failed to start scraping job" }, { status: 500 });
    }

    const apifyResult = await apifyResponse.json();
    console.log("Apify run started:", apifyResult.data?.id);

    return NextResponse.json({
      success: true,
      runId: apifyResult.data?.id,
      status: apifyResult.data?.status,
      message: "Scraping job started. Use the runId to check status.",
    });

  } catch (error) {
    console.error("Scrape likes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check the status of a scraping run
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const runId = request.nextUrl.searchParams.get("runId");

    if (!runId) {
      return NextResponse.json({ error: "Run ID required" }, { status: 400 });
    }

    // Check run status
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );

    if (!statusResponse.ok) {
      return NextResponse.json({ error: "Failed to get run status" }, { status: 500 });
    }

    const statusResult = await statusResponse.json();

    // If the run is finished, get the results
    if (statusResult.data?.status === "SUCCEEDED") {
      const datasetId = statusResult.data?.defaultDatasetId;
      
      const resultsResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
      );

      if (resultsResponse.ok) {
        const results = await resultsResponse.json();
        return NextResponse.json({
          status: "SUCCEEDED",
          results: results,
          count: results.length,
        });
      }
    }

    return NextResponse.json({
      status: statusResult.data?.status,
      message: `Run is ${statusResult.data?.status?.toLowerCase()}...`,
    });

  } catch (error) {
    console.error("Check status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

