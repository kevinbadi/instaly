import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser, getInstagramAccounts } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(user.id, user.email!, user.user_metadata?.full_name);
    const accounts = await getInstagramAccounts(dbUser.id);

    // Add session status to each account
    const accountsWithSession = await Promise.all(
      accounts.map(async (account) => {
        const { data: session } = await supabase
          .from("instagram_sessions")
          .select("status")
          .eq("instagram_account_id", account.id)
          .single();
        
        return {
          ...account,
          session_status: session?.status || "no_session",
        };
      })
    );

    return NextResponse.json({ accounts: accountsWithSession });
  } catch (error) {
    console.error("Instagram accounts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
