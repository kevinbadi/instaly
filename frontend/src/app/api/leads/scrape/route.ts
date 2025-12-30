import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getOrCreateUser } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

export async function POST(request: NextRequest) {
  console.log("=== SCRAPE API CALLED (Apify) ===");
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Auth failed: " + authError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized - no user found" }, { status: 401 });
    }

    if (!APIFY_API_TOKEN) {
      console.error("Apify API token not configured!");
      return NextResponse.json(
        { error: "Apify API not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { postUrl, campaignId, maxLikers = 100 } = body;

    if (!postUrl) {
      return NextResponse.json(
        { error: "Post URL is required" },
        { status: 400 }
      );
    }

    // Validate Instagram URL
    if (!postUrl.includes("instagram.com/p/") && !postUrl.includes("instagram.com/reel/")) {
      return NextResponse.json(
        { error: "Invalid Instagram post URL" },
        { status: 400 }
      );
    }

    // Get or create user in database
    const dbUser = await getOrCreateUser(user.id, user.email || "", user.user_metadata?.full_name);
    
    if (!dbUser) {
      return NextResponse.json({ error: "User record not found" }, { status: 500 });
    }

    // Get admin client for database operations
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user's active Instagram session
    const { data: accounts } = await adminClient
      .from("instagram_accounts")
      .select("id")
      .eq("user_id", dbUser.id)
      .eq("status", "active")
      .limit(1);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: "No Instagram account connected. Please connect your Instagram account first." },
        { status: 400 }
      );
    }

    const { data: session } = await adminClient
      .from("instagram_sessions")
      .select("session_id")
      .eq("instagram_account_id", accounts[0].id)
      .eq("status", "active")
      .single();

    if (!session?.session_id) {
      return NextResponse.json(
        { error: "Instagram session expired. Please reconnect your account." },
        { status: 400 }
      );
    }

    console.log(`Scraping ${postUrl} with Apify (max ${Math.min(maxLikers, 100)} likers)...`);

    // Launch Apify actor with user's Instagram cookie
    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/clothefobia~instagram-post-like-user-extractor/runs?token=${APIFY_API_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookies: [
            {
              name: "sessionid",
              value: session.session_id,
              domain: ".instagram.com",
            },
          ],
          proxy: {
            useApifyProxy: true,
          },
          maxLikers: Math.min(maxLikers, 100), // Apify caps at 100
          urls: [postUrl],
        }),
      }
    );

    if (!apifyResponse.ok) {
      const error = await apifyResponse.text();
      console.error("Apify launch error:", error);
      return NextResponse.json(
        { error: "Failed to start scraping" },
        { status: 500 }
      );
    }

    const apifyData = await apifyResponse.json();
    const runId = apifyData.data?.id;
    const datasetId = apifyData.data?.defaultDatasetId;

    console.log(`Apify run started: ${runId}`);

    // Wait for completion and get results
    const result = await waitForApifyCompletion(runId, datasetId, dbUser.id, campaignId, postUrl, accounts[0].id, adminClient);

    if (result.error) {
      // If session expired, return specific error
      if (result.sessionExpired) {
        return NextResponse.json({
          success: false,
          error: "Your Instagram session has expired. Please reconnect your Instagram account.",
          sessionExpired: true,
        }, { status: 401 });
      }
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Scraping completed",
      leadsScraped: result.leadsScraped,
      runId,
    });

  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Wait for Apify to complete and store results
async function waitForApifyCompletion(
  runId: string,
  datasetId: string,
  userId: string,
  campaignId: string | undefined,
  postUrl: string,
  instagramAccountId: string,
  adminClient: any
): Promise<{ leadsScraped?: number; error?: string; sessionExpired?: boolean }> {
  const maxWaitTime = 180000; // 3 minutes
  const pollInterval = 3000; // 3 seconds
  const startTime = Date.now();

  console.log(`[Scrape] Waiting for Apify run ${runId} to complete...`);

  try {
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Scrape] Checking status... (${elapsed}s elapsed)`);

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
      );

      if (!statusResponse.ok) {
        console.log(`[Scrape] Status check failed: ${statusResponse.status}`);
        continue;
      }

      const statusData = await statusResponse.json();
      const status = statusData.data?.status;
      console.log(`[Scrape] Run status: ${status}`);

      if (status === "SUCCEEDED") {
        console.log(`[Scrape] Run completed, fetching results...`);

        // Fetch results from dataset
        const resultsResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`
        );

        if (!resultsResponse.ok) {
          return { error: "Failed to fetch scrape results" };
        }

        const leads = await resultsResponse.json();
        console.log(`[Scrape] Got ${leads.length} leads from Apify`);

        if (Array.isArray(leads) && leads.length > 0) {
          const storedCount = await storeLeads(leads, userId, campaignId, postUrl);
          console.log(`[Scrape] Stored ${storedCount} leads in database`);
          return { leadsScraped: storedCount };
        }

        return { leadsScraped: 0 };

      } else if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        // Check if it's a session/auth issue by looking at logs
        console.log(`[Scrape] Run failed with status: ${status}`);
        
        // Mark session as expired since the scrape failed (likely auth issue)
        if (status === "FAILED") {
          console.log(`[Scrape] Marking session as expired for account ${instagramAccountId}`);
          await adminClient
            .from("instagram_sessions")
            .update({ status: "expired" })
            .eq("instagram_account_id", instagramAccountId);
          
          return { error: "Instagram session expired", sessionExpired: true };
        }
        
        return { error: `Scrape ${status.toLowerCase()}` };
      }
      // Still running, continue polling
    }

    return { error: "Scrape timed out after 3 minutes" };

  } catch (error) {
    console.error("[Scrape] Error:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Store leads in Supabase
async function storeLeads(
  leads: any[],
  userId: string,
  campaignId: string | undefined,
  postUrl: string
): Promise<number> {
  console.log(`[Store] Storing ${leads.length} leads for user ${userId}`);

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let insertedCount = 0;
  let errorCount = 0;

  for (const lead of leads) {
    // Apify returns username directly
    const username = lead.username;

    if (!username) {
      console.log(`[Store] Skipping lead with no username`);
      continue;
    }

    const leadData = {
      user_id: userId,
      campaign_id: campaignId || null,
      instagram_username: username,
      full_name: lead.full_name || null,
      profile_url: `https://instagram.com/${username}`,
      bio: null, // Apify like scraper doesn't include bio
      followers_count: null, // Would need separate API call
      is_verified: lead.is_verified || false,
      source_post_url: postUrl,
    };

    try {
      const { error } = await supabase
        .from("leads")
        .upsert(leadData, {
          onConflict: "user_id,instagram_username",
          ignoreDuplicates: true,
        });

      if (error) {
        console.error(`[Store] Error inserting ${username}:`, error.message);
        errorCount++;
      } else {
        insertedCount++;
      }
    } catch (e) {
      console.error(`[Store] Exception inserting ${username}:`, e);
      errorCount++;
    }
  }

  console.log(`[Store] Completed: ${insertedCount} inserted, ${errorCount} errors`);
  return insertedCount;
}
