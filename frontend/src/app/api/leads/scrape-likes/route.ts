import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
// Using "Instagram Likes Scraper (No Cookie)" by datadoping - works reliably without cookies
const APIFY_ACTOR_ID = "WxPRaG9gfg5KZ4gY1";

export async function POST(request: NextRequest) {
  console.log("=== APIFY LIKES SCRAPE API CALLED ===");
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!APIFY_API_TOKEN) {
      console.error("Apify API token not configured!");
      return NextResponse.json(
        { error: "Apify not configured. Please add APIFY_API_TOKEN to environment." },
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
        { error: "Invalid Instagram post URL. Must be a post or reel URL." },
        { status: 400 }
      );
    }

    // Get user from database
    const dbUser = await getOrCreateUser(user.id, user.email || "", user.user_metadata?.full_name);
    
    if (!dbUser) {
      return NextResponse.json({ error: "User record not found" }, { status: 500 });
    }

    console.log(`Logged in user: ${user.email} (Auth ID: ${user.id})`);
    console.log(`DB User ID: ${dbUser.id}`);

    // Build Apify actor input for datadoping's "Instagram Likes Scraper (No Cookie)"
    // This actor doesn't require cookies - it works with public Instagram data
    const actorInput = {
      posts: [postUrl],
      max_count: maxLikers,
    };

    console.log("Starting Apify actor run...");
    console.log("Actor ID:", APIFY_ACTOR_ID);
    console.log("Post URL:", postUrl);
    console.log("Max likers:", maxLikers);

    // Start the Apify actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(actorInput),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error("Apify run start failed:", errorText);
      return NextResponse.json(
        { error: "Failed to start Apify scraper: " + errorText },
        { status: 500 }
      );
    }

    const runData = await runResponse.json();
    const runId = runData.data?.id;
    
    if (!runId) {
      console.error("No run ID returned from Apify");
      return NextResponse.json(
        { error: "Failed to get run ID from Apify" },
        { status: 500 }
      );
    }

    console.log("Apify run started:", runId);

    // Poll for completion
    const result = await waitForApifyCompletion(runId, dbUser.id, campaignId, postUrl);

    if (result.error) {
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
    console.error("Apify scrape error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function waitForApifyCompletion(
  runId: string,
  userId: string,
  campaignId: string | undefined,
  postUrl: string
): Promise<{ leadsScraped?: number; error?: string }> {
  const maxWaitTime = 240000; // 4 minutes
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();

  console.log(`[Apify] Waiting for run ${runId} to complete...`);

  try {
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Apify] Checking status... (${elapsed}s elapsed)`);

      // Check run status
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`,
        { headers: { "Content-Type": "application/json" } }
      );

      if (!statusResponse.ok) {
        console.log(`[Apify] Status check failed: ${statusResponse.status}`);
        continue;
      }

      const statusData = await statusResponse.json();
      const status = statusData.data?.status;
      
      console.log(`[Apify] Run status: ${status}`);

      if (status === "SUCCEEDED") {
        console.log(`[Apify] Run completed, fetching dataset...`);
        
        const datasetId = statusData.data?.defaultDatasetId;
        if (!datasetId) {
          return { error: "No dataset ID found" };
        }

        // Fetch the results from the dataset
        const datasetResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`,
          { headers: { "Content-Type": "application/json" } }
        );

        if (!datasetResponse.ok) {
          return { error: "Failed to fetch results from Apify dataset" };
        }

        const leads = await datasetResponse.json();
        console.log(`[Apify] Got ${leads.length} leads from dataset`);

        if (Array.isArray(leads) && leads.length > 0) {
          const storedCount = await storeApifyLeads(leads, userId, campaignId, postUrl);
          console.log(`[Apify] Stored ${storedCount} leads in database`);
          return { leadsScraped: storedCount };
        }

        return { leadsScraped: 0 };

      } else if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        const errorMessage = statusData.data?.exitErrorMessage || `Run ${status}`;
        return { error: errorMessage };
      }
      
      // Still running (RUNNING, READY), continue polling
    }

    return { error: "Scrape timed out after 4 minutes" };

  } catch (error) {
    console.error("[Apify] Error:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function storeApifyLeads(
  leads: any[],
  userId: string,
  campaignId: string | undefined,
  postUrl: string
): Promise<number> {
  console.log(`[Store] Storing ${leads.length} Apify leads for user ${userId}`);

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let insertedCount = 0;
  let errorCount = 0;

  for (const lead of leads) {
    // datadoping actor returns: username, full_name, id, is_verified, is_private, profile_pic_url, total_likes
    const username = lead.username;

    if (!username) {
      console.log(`[Store] Skipping lead with no username:`, JSON.stringify(lead).substring(0, 100));
      continue;
    }

    const leadData = {
      user_id: userId,
      campaign_id: campaignId || null,
      instagram_username: username,
      full_name: lead.full_name || null,
      profile_url: `https://instagram.com/${username}`,
      bio: null, // Actor doesn't provide bio
      followers_count: null, // Actor doesn't provide follower count
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
