import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id,title,updated_at,created_at,kb_ids")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let title: string | null = "New conversation";
  let kb_ids: string[] = [];
  try {
    const body = (await req.json()) as { title?: string | null; kb_ids?: string[] | null };
    if (body && "title" in body) title = body.title ?? null;
    if (body && Array.isArray(body.kb_ids)) kb_ids = body.kb_ids.map(String).filter(Boolean);
  } catch {
    // empty body is fine
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: user.id,
      title,
      kb_ids,
    })
    .select("id,title,updated_at,created_at,kb_ids")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

