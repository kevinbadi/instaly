import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/db";

const PHANTOMBUSTER_API_KEY = process.env.PHANTOMBUSTER_API_KEY;
const PHANTOMBUSTER_AGENT_ID = process.env.PHANTOMBUSTER_AGENT_ID;

const PB_BASE_URL = "https://api.phantombuster.com/api/v2";

interface ScrapeStatus {
  status: "idle" | "running" | "completed" | "failed";
  containerId?: string;
  leadsScraped?: number;
  error?: string;
}

// In-memory store for scrape status (in production, use Redis or database)
const scrapeStatusMap = new Map<string, ScrapeStatus>();

export async function POST(request: NextRequest) {
  console.log("=== SCRAPE API CALLED ===");
  console.log("PHANTOMBUSTER_API_KEY:", PHANTOMBUSTER_API_KEY ? "SET" : "NOT SET");
  console.log("PHANTOMBUSTER_AGENT_ID:", PHANTOMBUSTER_AGENT_ID);
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    console.log("User:", user?.id);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!PHANTOMBUSTER_API_KEY || !PHANTOMBUSTER_AGENT_ID) {
      console.error("PhantomBuster not configured!");
      return NextResponse.json(
        { error: "PhantomBuster not configured" },
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

    const dbUser = await getOrCreateUser(user.id, user.email!, user.user_metadata?.full_name);

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

    // Store scrape job info
    const scrapeJobId = `${dbUser.id}_${Date.now()}`;
    scrapeStatusMap.set(scrapeJobId, {
      status: "running",
      containerId,
    });

    // Start background polling (don't await)
    pollAndStoreResults(
      scrapeJobId,
      containerId,
      dbUser.id,
      campaignId,
      postUrl
    );

    return NextResponse.json({
      success: true,
      message: "Scraping started",
      scrapeJobId,
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

// GET endpoint to check scrape status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const scrapeJobId = searchParams.get("jobId");

    if (!scrapeJobId) {
      return NextResponse.json(
        { error: "Job ID required" },
        { status: 400 }
      );
    }

    const status = scrapeStatusMap.get(scrapeJobId);

    if (!status) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Background function to poll PhantomBuster and store results
async function pollAndStoreResults(
  scrapeJobId: string,
  containerId: string,
  userId: string,
  campaignId: string | undefined,
  postUrl: string
) {
  const maxWaitTime = 300000; // 5 minutes
  const pollInterval = 10000; // 10 seconds
  const startTime = Date.now();

  console.log(`[Poll] Starting poll for job ${scrapeJobId}, container ${containerId}`);

  try {
    // Wait for completion
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      console.log(`[Poll] Checking container ${containerId} status...`);

      const statusResponse = await fetch(
        `${PB_BASE_URL}/containers/fetch?id=${containerId}`,
        {
          headers: {
            "X-Phantombuster-Key": PHANTOMBUSTER_API_KEY!,
          },
        }
      );

      if (!statusResponse.ok) {
        console.log(`[Poll] Status check failed: ${statusResponse.status}`);
        continue;
      }

      const statusData = await statusResponse.json();
      console.log(`[Poll] Container status: ${statusData.status}`);
      
      if (statusData.status === "finished") {
        // Fetch output to get the S3 URL
        console.log(`[Poll] Container finished, fetching output...`);
        
        const outputResponse = await fetch(
          `${PB_BASE_URL}/agents/fetch-output?id=${PHANTOMBUSTER_AGENT_ID}`,
          {
            headers: {
              "X-Phantombuster-Key": PHANTOMBUSTER_API_KEY!,
            },
          }
        );

        if (outputResponse.ok) {
          const outputData = await outputResponse.json();
          console.log(`[Poll] Output fetched, parsing for S3 URL...`);
          
          // Extract the JSON S3 URL from the output
          const output = outputData.output || "";
          const jsonUrlMatch = output.match(/https:\/\/phantombuster\.s3\.amazonaws\.com\/[^\s]+result\.json/);
          
          if (jsonUrlMatch) {
            const jsonUrl = jsonUrlMatch[0];
            console.log(`[Poll] Fetching results from S3: ${jsonUrl}`);
            
            // Fetch the actual results from S3
            const s3Response = await fetch(jsonUrl);
            if (s3Response.ok) {
              const leads = await s3Response.json();
              console.log(`[Poll] Got ${leads.length} leads from S3`);
              
              if (Array.isArray(leads) && leads.length > 0) {
                // Store leads in database
                const storedCount = await storeLeads(leads, userId, campaignId, postUrl);
                console.log(`[Poll] Stored ${storedCount} leads in database`);
                
                scrapeStatusMap.set(scrapeJobId, {
                  status: "completed",
                  containerId,
                  leadsScraped: storedCount,
                });
              } else {
                scrapeStatusMap.set(scrapeJobId, {
                  status: "completed",
                  containerId,
                  leadsScraped: 0,
                });
              }
            } else {
              console.error(`[Poll] Failed to fetch S3 results: ${s3Response.status}`);
              scrapeStatusMap.set(scrapeJobId, {
                status: "completed",
                containerId,
                leadsScraped: 0,
                error: "Failed to fetch results from S3",
              });
            }
          } else {
            console.log(`[Poll] No JSON URL found in output`);
            scrapeStatusMap.set(scrapeJobId, {
              status: "completed",
              containerId,
              leadsScraped: 0,
            });
          }
        }
        return;
      } else if (statusData.status === "error") {
        console.error(`[Poll] Container error: ${statusData.error}`);
        scrapeStatusMap.set(scrapeJobId, {
          status: "failed",
          containerId,
          error: statusData.error || "Scrape failed",
        });
        return;
      }
    }

    // Timeout
    console.error(`[Poll] Scrape timed out after ${maxWaitTime}ms`);
    scrapeStatusMap.set(scrapeJobId, {
      status: "failed",
      containerId,
      error: "Scrape timed out",
    });
  } catch (error) {
    console.error("[Poll] Error:", error);
    scrapeStatusMap.set(scrapeJobId, {
      status: "failed",
      containerId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
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
