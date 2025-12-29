import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max (requires Vercel Pro)

const PHANTOMBUSTER_API_KEY = process.env.PHANTOMBUSTER_API_KEY;
const PHANTOMBUSTER_AGENT_ID = process.env.PHANTOMBUSTER_AGENT_ID;

const PB_BASE_URL = "https://api.phantombuster.com/api/v2";

export async function POST(request: NextRequest) {
  console.log("=== SCRAPE API CALLED ===");
  console.log("Environment check:");
  console.log("- PHANTOMBUSTER_API_KEY:", PHANTOMBUSTER_API_KEY ? "SET (" + PHANTOMBUSTER_API_KEY.substring(0, 5) + "...)" : "NOT SET");
  console.log("- PHANTOMBUSTER_AGENT_ID:", PHANTOMBUSTER_AGENT_ID || "NOT SET");
  console.log("- SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT SET");
  console.log("- SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "NOT SET");
  console.log("- SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT SET");
  
  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch (clientError) {
      console.error("Failed to create Supabase client:", clientError);
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Auth failed: " + authError.message }, { status: 401 });
    }

    console.log("User:", user?.id);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized - no user found" }, { status: 401 });
    }

    if (!PHANTOMBUSTER_API_KEY || !PHANTOMBUSTER_AGENT_ID) {
      console.error("PhantomBuster not configured!");
      return NextResponse.json(
        { error: "PhantomBuster not configured" },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    
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

    let dbUser;
    try {
      console.log("Getting/creating user in DB...");
      dbUser = await getOrCreateUser(user.id, user.email || "", user.user_metadata?.full_name);
      console.log("DB user obtained:", dbUser?.id);
    } catch (dbError: any) {
      console.error("Failed to get/create user:", dbError);
      console.error("Error details:", JSON.stringify(dbError, null, 2));
      return NextResponse.json({ 
        error: "Database error: " + (dbError?.message || "user creation failed") 
      }, { status: 500 });
    }
    
    if (!dbUser) {
      console.error("dbUser is null/undefined after getOrCreateUser");
      return NextResponse.json({ error: "User record not found" }, { status: 500 });
    }

    // Get session cookie for authenticated scraping (optional)
    let sessionCookie: string | undefined;
    const { data: accounts } = await supabase
      .from("instagram_accounts")
      .select("id")
      .eq("user_id", dbUser.id)
      .eq("status", "active")
      .limit(1);

    if (accounts && accounts.length > 0) {
      const { data: session } = await supabase
        .from("instagram_sessions")
        .select("session_id")
        .eq("instagram_account_id", accounts[0].id)
        .eq("status", "active")
        .single();
      
      if (session) {
        sessionCookie = session.session_id;
      }
    }

    // Launch PhantomBuster
    console.log("Launching PhantomBuster scrape for:", postUrl);
    
    const launchPayload: any = {
      id: PHANTOMBUSTER_AGENT_ID,
      argument: {
        spreadsheetUrl: postUrl,
        numberOfLikersPerPost: maxLikers,
      }
    };

    if (sessionCookie) {
      launchPayload.argument.sessionCookie = sessionCookie;
    }

    console.log("Sending to PhantomBuster:", JSON.stringify(launchPayload, null, 2));

    const launchResponse = await fetch(`${PB_BASE_URL}/agents/launch`, {
      method: "POST",
      headers: {
        "X-Phantombuster-Key": PHANTOMBUSTER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(launchPayload),
    });

    console.log("PhantomBuster response status:", launchResponse.status);

    if (launchResponse.status === 429) {
      return NextResponse.json(
        { error: "PhantomBuster is busy. Please wait for the current scrape to finish." },
        { status: 429 }
      );
    }

    if (!launchResponse.ok) {
      const error = await launchResponse.text();
      console.error("PhantomBuster launch error:", error);
      return NextResponse.json(
        { error: "Failed to start scraping" },
        { status: 500 }
      );
    }

    const launchData = await launchResponse.json();
    const containerId = launchData.containerId;
    console.log("PhantomBuster container ID:", containerId);

    console.log("PhantomBuster container launched:", containerId);

    // Wait for PhantomBuster to complete and store results
    // (Vercel serverless doesn't support background tasks)
    console.log("Waiting for PhantomBuster to complete...");
    
    const result = await waitForCompletionAndStore(
      containerId,
      dbUser.id,
      campaignId,
      postUrl
    );

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
      containerId,
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Synchronous function to wait for PhantomBuster completion and store results
async function waitForCompletionAndStore(
  containerId: string,
  userId: string,
  campaignId: string | undefined,
  postUrl: string
): Promise<{ leadsScraped?: number; error?: string }> {
  const maxWaitTime = 180000; // 3 minutes (Vercel timeout is ~5min for Pro)
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();

  console.log(`[Scrape] Waiting for container ${containerId} to complete...`);

  try {
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Scrape] Checking status... (${elapsed}s elapsed)`);

      const statusResponse = await fetch(
        `${PB_BASE_URL}/containers/fetch?id=${containerId}`,
        {
          headers: {
            "X-Phantombuster-Key": PHANTOMBUSTER_API_KEY!,
          },
        }
      );

      if (!statusResponse.ok) {
        console.log(`[Scrape] Status check failed: ${statusResponse.status}`);
        continue;
      }

      const statusData = await statusResponse.json();
      console.log(`[Scrape] Container status: ${statusData.status}`);
      
      if (statusData.status === "finished") {
        console.log(`[Scrape] Container finished, fetching output...`);
        
        const outputResponse = await fetch(
          `${PB_BASE_URL}/agents/fetch-output?id=${PHANTOMBUSTER_AGENT_ID}`,
          {
            headers: {
              "X-Phantombuster-Key": PHANTOMBUSTER_API_KEY!,
            },
          }
        );

        if (!outputResponse.ok) {
          return { error: "Failed to fetch scrape output" };
        }

        const outputData = await outputResponse.json();
        const output = outputData.output || "";
        
        // Extract the JSON S3 URL from the output
        const jsonUrlMatch = output.match(/https:\/\/phantombuster\.s3\.amazonaws\.com\/[^\s]+result\.json/);
        
        if (!jsonUrlMatch) {
          console.log(`[Scrape] No JSON URL found in output`);
          return { leadsScraped: 0 };
        }

        const jsonUrl = jsonUrlMatch[0];
        console.log(`[Scrape] Fetching results from S3: ${jsonUrl}`);
        
        const s3Response = await fetch(jsonUrl);
        if (!s3Response.ok) {
          return { error: "Failed to fetch results from S3" };
        }

        const leads = await s3Response.json();
        console.log(`[Scrape] Got ${leads.length} leads from S3`);
        
        if (Array.isArray(leads) && leads.length > 0) {
          const storedCount = await storeLeads(leads, userId, campaignId, postUrl);
          console.log(`[Scrape] Stored ${storedCount} leads in database`);
          return { leadsScraped: storedCount };
        }
        
        return { leadsScraped: 0 };
        
      } else if (statusData.status === "error") {
        return { error: statusData.error || "Scrape failed" };
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
  
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let insertedCount = 0;
  let errorCount = 0;

  for (const lead of leads) {
    // Extract username
    let username = lead.username;
    if (!username && lead.profileUrl) {
      const parts = lead.profileUrl.replace(/\/$/, "").split("/");
      username = parts[parts.length - 1];
    }

    if (!username) {
      console.log(`[Store] Skipping lead with no username`);
      continue;
    }

    const leadData = {
      user_id: userId,
      campaign_id: campaignId || null,
      instagram_username: username,
      full_name: lead.fullName || lead.name || null,
      profile_url: lead.profileUrl || null,
      bio: lead.bio || null,
      followers_count: lead.followersCount || null,
      is_verified: lead.isVerified || lead.verified || false,
      source_post_url: postUrl,
    };

    try {
      const { data, error } = await supabase
        .from("leads")
        .upsert(leadData, {
          onConflict: "user_id,instagram_username",
          ignoreDuplicates: true,
        })
        .select();

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
