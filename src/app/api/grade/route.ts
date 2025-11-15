import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type GradeRequest = { userId: string; problemId: number; answer: string };
type RuleResult = { score: number; confident: boolean; note?: string };

function ruleGrade(type: string, answerKey: any, studentRaw: string): RuleResult {
  if (type === "mcq") {
    const student = studentRaw.trim().toUpperCase(); // 예: "A"
    const correct: string[] = answerKey?.correct ?? [];
    const ok = correct.includes(student);
    return { score: ok ? 1 : 0, confident: true, note: ok ? "정답" : "오답" };
  }
  if (type === "numeric") {
    const val = parseFloat(studentRaw.replace(/,/g, "."));
    if (Number.isNaN(val)) return { score: 0, confident: false };
    const target = Number(answerKey?.value);
    const tol = Number(answerKey?.tol_abs ?? 0);
    const ok = Math.abs(val - target) <= tol;
    return { score: ok ? 1 : 0, confident: true, note: ok ? "정답" : `허용오차 ±${tol}` };
  }
  return { score: 0, confident: false };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GradeRequest;

  // 서버 전용 키로 Supabase 연결
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // 문제 로드
  const { data: problem, error: pErr } = await supabase
    .from("problems")
    .select("id,type,answer_key_json")
    .eq("id", body.problemId)
    .single();

  if (pErr || !problem) {
    return NextResponse.json({ error: "problem_not_found" }, { status: 404 });
  }

  // 규칙 채점
  const r = ruleGrade(problem.type, problem.answer_key_json, body.answer);

  // 제출 기록(임시 userId 사용)
  const { error: sErr } = await supabase.from("submissions").insert({
    user_id: body.userId,
    problem_id: body.problemId,
    answer_raw: body.answer,
    score: r.score,
    status: "graded",
  });

  if (sErr) {
    return NextResponse.json({ error: "submit_failed", detail: sErr.message }, { status: 500 });
  }

  return NextResponse.json({ score: r.score, feedback: r.note, policy: "rule" });
}
