import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY! // 서버 전용 키로 RLS 우회
  );

  const { data, error } = await supabase
    .from("problems")
    .select("id, type, body, chapter_id")
    .eq("chapter_id", 1)
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "load_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ problems: data ?? [] });
}
