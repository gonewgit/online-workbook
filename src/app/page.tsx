"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Problem = {
  id: number;
  type: "mcq" | "numeric";
  body: { prompt: string; choices?: string[] };
};

const TEMP_USER = "00000000-0000-0000-0000-000000000001"; // 임시 사용자 ID

export default function Home() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Record<number, { score: number; feedback?: string }>>({});

useEffect(() => {
  (async () => {
    const res = await fetch("/api/problems", { cache: "no-store" });
    const json = await res.json();
    if (json?.problems) setProblems(json.problems);
  })();
}, []);

  const submit = async (pid: number) => {
    const answer = answers[pid] ?? "";
    const res = await fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: TEMP_USER, problemId: pid, answer }),
    });
    const data = await res.json();
    setResult((r) => ({ ...r, [pid]: { score: data.score, feedback: data.feedback } }));
  };

<div style={{ position: "fixed", top: 12, right: 12 }}><a href="/login">로그인</a></div>

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>온라인 실습 교재 — 샘플</h1>
      <p>Chapter 1의 샘플 문제 2개로 동작 확인</p>
      <hr />
      {problems.map((p) => {
        const prompt = p.body?.prompt ?? "";
        const choices = p.body?.choices ?? [];
        return (
          <div key={p.id} style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <div>
              <b>Q{p.id}.</b> {prompt}
            </div>

            {p.type === "mcq" ? (
              <div style={{ marginTop: 8 }}>
                {choices.map((c, idx) => (
                  <label key={idx} style={{ display: "block", marginBottom: 4 }}>
                    <input
                      type="radio"
                      name={`q_${p.id}`}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [p.id]: String.fromCharCode(65 + idx) }))
                      }
                    />
                    &nbsp;{String.fromCharCode(65 + idx)}. {c}
                  </label>
                ))}
              </div>
            ) : (
              <input
                style={{ width: "100%", marginTop: 8 }}
                placeholder="정답 입력"
                onChange={(e) => setAnswers((a) => ({ ...a, [p.id]: e.target.value }))}
              />
            )}

            <button style={{ marginTop: 8 }} onClick={() => submit(p.id)}>
              제출
            </button>
            {result[p.id] && (
              <div style={{ marginTop: 8 }}>
                <b>점수:</b> {result[p.id].score} / 1 &nbsp; <i>{result[p.id].feedback}</i>
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}

