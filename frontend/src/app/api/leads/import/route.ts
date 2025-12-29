import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(user.id, user.email!, user.user_metadata?.full_name);

    const contentType = request.headers.get("content-type") || "";
    
    let leads: { instagram_username: string; full_name?: string }[] = [];
    let campaignId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      campaignId = formData.get("campaign_id") as string | null;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());
      const startIndex = lines[0]?.toLowerCase().includes("username") ? 1 : 0;
      
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(",").map(p => p.trim().replace(/"/g, ""));
        if (parts[0]) {
          leads.push({
            instagram_username: parts[0].replace("@", ""),
            full_name: parts[1] || undefined,
          });
        }
      }
    } else {
      const body = await request.json();
      leads = body.leads || [];
      campaignId = body.campaign_id || null;

      if (body.usernames && Array.isArray(body.usernames)) {
        leads = body.usernames.map((u: string) => ({
          instagram_username: u.replace("@", "").trim(),
        }));
      }
    }

    if (leads.length === 0) {
      return NextResponse.json({ error: "No leads provided" }, { status: 400 });
    }

    let insertedCount = 0;
    for (const lead of leads) {
      if (!lead.instagram_username) continue;

      const { error } = await supabase
        .from("leads")
        .upsert(
          {
            user_id: dbUser.id,
            campaign_id: campaignId,
            instagram_username: lead.instagram_username,
            full_name: lead.full_name || null,
          },
          { onConflict: "user_id,instagram_username", ignoreDuplicates: true }
        );

      if (!error) insertedCount++;
    }

    return NextResponse.json({
      success: true,
      count: insertedCount,
      message: `Imported ${insertedCount} leads`,
    });
  } catch (error) {
    console.error("Import leads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



