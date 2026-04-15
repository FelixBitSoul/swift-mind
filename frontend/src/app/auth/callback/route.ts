import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    redirect(`/login?error=${encodeURIComponent("Missing OAuth code")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

