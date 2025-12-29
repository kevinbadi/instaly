import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Check session status
    const { data, error } = await supabase
      .from("steel_session_queue")
      .select("status")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      // If no queue entry, assume manual navigation is needed
      return NextResponse.json({ status: "manual" });
    }

    return NextResponse.json({ status: data.status });
  } catch (error) {
    console.error("Steel status error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

