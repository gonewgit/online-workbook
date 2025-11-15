"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

// ---------- 공통: 채점 호출 ----------
async function grade(problemId: number, answer: string) {
  const res = await fetch("/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemId, answer }),
  });
  if (!res.ok) throw new Error("grading failed");
  return res.json() as Promise<{ score: number; feedback?: string }>;
}

export default function Home() {
  // 로그인 상태
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  // Q1: MCQ
  const [q1, setQ1] = useState<string>("");
  const [q1Res, setQ1Res] = useState<{ score: number; feedback?: string }>();
  const [q1Busy, setQ1Busy] = useState(false);

  // Q2: Numeric
  const [q2, setQ2] = useState<string>("");
  const [q2Res, setQ2Res] = useState<{ score: number; feedback?: string }>();
  const [q2Busy, setQ2Busy] = useState(false);

  // 로그인 상태 확인
  useEffect(() => {
    const sb = supabaseBrowser();

    // 최초 세션
    sb.auth.getSession().then(({ data }) => {
      setIsAuthed(!!data.session);
      setLoading(false);
    });

    // 실시간 상태 변경 반영
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const submitQ1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setQ1Busy(true);
    try {
      const r = await grade(1, q1 || "");
      setQ1Res(r);
    } finally {
      setQ1Busy(false);
    }
  };

  const submitQ2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setQ2Busy(true);
    try {
      const r = await grade(2, q2 || "");
      setQ2Res(r);
    } finally {
      setQ2Busy(false);
    }
  };

  // 상단 고정 링크
  const TopRight = () => (
    <div style={{ position: "fixed", top: 12, right: 12 }}>
      {isAuthed ? (
        <a
          href="#"
          onClick={async (e) => {
            e.preventDefault();
            await supabaseBrowser().auth.signOut();
            location.reload();
          }}
        >
          로그아웃
        </a>
      ) : (
        <a href="/login">로그인</a>
      )}
    </div>
  );

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
        <TopRight />
        <p>로딩 중…</p>
      </main>
    );
  }

  // 로그인 안 된 경우: 문제 가림막
  if (!isAuthed) {
    return (
      <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
        <TopRight />
        <h1 style={{ fontSize: 40, fontWeight: 800 }}>온라인 실습 교재 — 샘플</h1>
        <p style={{ marginTop: 12 }}>
          이 콘텐츠는 <b>로그인 후</b> 이용할 수 있습니다.
        </p>
        <p style={{ marginTop: 8 }}>
          우측 상단 <b>로그인</b>을 클릭하여 이메일 매직링크로 로그인하세요.
        </p>
      </main>
    );
  }

  // 로그인된 경우: 문제 표시
  return (
    <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
      <TopRight />

      <h1 style={{ fontSize: 40, fontWeight: 800 }}>온라인 실습 교재 — 샘플</h1>
      <p style={{ marginBottom: 24 }}>Chapter 1의 샘플 문제 2개로 동작 확인</p>

      {/* Q1 */}
      <section
        style={{
          border: "1px solid #666",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <h3>Q1. 샤논 용량 공식에서 용량 C의 단위는?</h3>
        <form onSubmit={submitQ1}>
          <div style={{ display: "grid", gap: 10, marginTop: 8, marginBottom: 12 }}>
            <label>
              <input
                type="radio"
                name="q1"
                value="A"
                checked={q1 === "A"}
                onChange={(e) => setQ1(e.target.value)}
              />{" "}
              A. bps
            </label>
            <label>
              <input
                type="radio"
                name="q1"
                value="B"
                checked={q1 === "B"}
                onChange={(e) => setQ1(e.target.value)}
              />{" "}
              B. Hz
            </label>
            <label>
              <input
                type="radio"
                name="q1"
                value="C"
                checked={q1 === "C"}
                onChange={(e) => setQ1(e.target.value)}
              />{" "}
              C. dB
            </label>
            <label>
              <input
                type="radio"
                name="q1"
                value="D"
                checked={q1 === "D"}
                onChange={(e) => setQ1(e.target.value)}
              />{" "}
              D. W
            </label>
          </div>
          <button disabled={q1Busy} type="submit">
            {q1Busy ? "채점 중..." : "제출"}
          </button>
        </form>
        {q1Res && (
          <p style={{ marginTop: 10 }}>
            점수: {q1Res.score} / 1{" "}
            {q1Res.feedback ? `— ${q1Res.feedback}` : q1Res.score ? "정답" : "오답"}
          </p>
        )}
      </section>

      {/* Q2 */}
      <section
        style={{
          border: "1px solid #666",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <h3>Q2. π 값을 소수 둘째자리까지 반올림하여 입력하세요.</h3>
        <form onSubmit={submitQ2}>
          <input
            type="text"
            placeholder="정답 입력"
            value={q2}
            onChange={(e) => setQ2(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 8, marginBottom: 12 }}
          />
          <button disabled={q2Busy} type="submit">
            {q2Busy ? "채점 중..." : "제출"}
          </button>
        </form>
        {q2Res && (
          <p style={{ marginTop: 10 }}>
            점수: {q2Res.score} / 1{" "}
            {q2Res.feedback ? `— ${q2Res.feedback}` : q2Res.score ? "정답" : "오답"}
          </p>
        )}
      </section>
    </main>
  );
}
