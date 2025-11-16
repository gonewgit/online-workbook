"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Problem = {
  id: number;
  chapter_id: number;
  type: string;          // 'short' | 'essay' | 'mcq' | 'numeric'
  body: any;             // string or JSON {prompt, choices?, placeholder?}
  grading_mode?: string; // 'short' | 'essay' | 'numeric' | 'mcq'
};

type GradeRes = { score: number; feedback?: string };

async function grade(problemId: number, answer: string) {
  const res = await fetch("/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemId, answer }),
  });
  if (!res.ok) throw new Error("grading failed");
  return (await res.json()) as GradeRes;
}

function parseBody(b: any): { prompt: string; choices: string[] | null; placeholder?: string } {
  try {
    if (typeof b === "string") return { prompt: b, choices: null };
    if (b && typeof b === "object") {
      const prompt = typeof b.prompt === "string" ? b.prompt : JSON.stringify(b);
      const choices = Array.isArray(b.choices) ? (b.choices as string[]) : null;
      const placeholder = typeof b.placeholder === "string" ? b.placeholder : undefined;
      return { prompt, choices, placeholder };
    }
    return { prompt: String(b ?? ""), choices: null };
  } catch {
    return { prompt: String(b ?? ""), choices: null };
  }
}

export default function Home() {
  // 인증 / 권한
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isEntitled, setIsEntitled] = useState<boolean | null>(null);

  // 문제 목록
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(true);

  // 답안/채점
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [grading, setGrading] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<Record<number, GradeRes>>({});

  // 언락된 마지막 문제 인덱스 (처음엔 0번만 보이게)
  const [unlockedIdx, setUnlockedIdx] = useState(0);

  // 스크롤/섹션 참조
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // ---------- 인증/권한 ----------
  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb.auth.getSession();
      const authed = !!data.session;
      setIsAuthed(authed);
      if (authed) {
        const { data: ent, error } = await sb
          .from("entitlements")
          .select("user_id")
          .eq("chapter_id", 1)
          .maybeSingle();
        setIsEntitled(!error && !!ent);
      } else {
        setIsEntitled(null);
      }
      setLoadingAuth(false);
    })();

    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const A = !!session;
      setIsAuthed(A);
      if (!A) setIsEntitled(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---------- 문제 로드 ----------
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingProblems(true);
        const res = await fetch("/api/problems?chapter=1", { cache: "no-store" });
        if (!res.ok) throw new Error("failed to load problems");
        const data = (await res.json()) as Problem[];
        setProblems(data);
        // 처음 진입 시 0번만 열어두기
        setUnlockedIdx(0);
      } finally {
        setLoadingProblems(false);
      }
    };
    load();
  }, []);

  // ---------- 상태별 화면 ----------
  const TopRight = () => (
    <div style={{ position: "fixed", top: 12, right: 12, zIndex: 50 }}>
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

  if (loadingAuth) {
    return (
      <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
        <TopRight />
        <p>로딩 중…</p>
      </main>
    );
  }
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
  if (isEntitled === false) {
    return (
      <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
        <TopRight />
        <h1 style={{ fontSize: 40, fontWeight: 800 }}>수강권이 필요합니다</h1>
        <p style={{ marginTop: 12 }}>
          현재 계정에는 <b>Chapter 1</b>에 대한 수강권이 없습니다.
        </p>
        <p style={{ marginTop: 8 }}>결제 후 자동으로 권한이 부여됩니다.</p>
      </main>
    );
  }

  // ---------- 입력 UI ----------
  const inputFor = (p: Problem) => {
    const mode = (p.grading_mode || p.type || "short").toLowerCase();
    const { choices, placeholder } = parseBody(p.body);
    const val = answers[p.id] ?? "";
    const set = (v: string) => setAnswers((a) => ({ ...a, [p.id]: v }));

    if (mode === "mcq" && choices && choices.length > 0) {
      return (
        <div style={{ display: "grid", gap: 8 }}>
          {choices.map((label, idx) => {
            const opt = String.fromCharCode(65 + idx); // A,B,C,...
            const checked = val === opt || val === label;
            return (
              <label key={idx} style={{ cursor: "pointer" }}>
                <input
                  type="radio"
                  name={`mcq-${p.id}`}
                  value={opt}
                  checked={checked}
                  onChange={(e) => set(e.target.value)}
                />{" "}
                {label}
              </label>
            );
          })}
        </div>
      );
    }

    if (mode === "essay") {
      return (
        <textarea
          placeholder={placeholder || "서술형 답안을 입력하세요"}
          value={val}
          onChange={(e) => set(e.target.value)}
          style={{ width: "100%", minHeight: 160, padding: 12 }}
        />
      );
    }

    return (
      <input
        type="text"
        placeholder={placeholder || "답안을 입력하세요"}
        value={val}
        onChange={(e) => set(e.target.value)}
        style={{ width: "100%", padding: 10 }}
      />
    );
  };

  // ---------- 제출 로직: 정답이면 다음 문제 언락 + 스크롤 ----------
  const onSubmit = async (e: React.FormEvent, p: Problem, indexInView: number) => {
    e.preventDefault();
    const ans = answers[p.id] ?? "";
    setGrading((g) => ({ ...g, [p.id]: true }));
    try {
      const res = await grade(p.id, ans);
      setResults((r) => ({ ...r, [p.id]: res }));

      // 정답이면 다음 문제 언락
      if (res.score && res.score > 0) {
        setUnlockedIdx((prev) => {
          const next = Math.min((problems.length || 1) - 1, Math.max(prev, indexInView + 1));
          // 스크롤을 다음 섹션으로 이동
          setTimeout(() => {
            const target = sectionRefs.current[next];
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 50);
          return next;
        });
      }
    } finally {
      setGrading((g) => ({ ...g, [p.id]: false }));
    }
  };

  // ---------- 렌더: 현재까지 언락된 문제까지만 표시 ----------
  const renderable = useMemo(() => {
    if (problems.length === 0) return [];
    const end = Math.min(unlockedIdx + 1, problems.length); // 현재까지
    return problems.slice(0, end);
  }, [problems, unlockedIdx]);

  const Sections = useMemo(
    () =>
      renderable.map((p, i) => {
        const { prompt } = parseBody(p.body);
        return (
          <section
            key={p.id}
            ref={(el: HTMLElement | null) => {
              sectionRefs.current[i] = el;
            }}
            style={{
              // 한 화면 = 한 카드
              scrollSnapAlign: "start",
              minHeight: "100%", // viewport 높이와 동일하게 보장 (container가 100vh)
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 16px",
            }}
          >
            <div
              style={{
                maxWidth: 900,
                width: "100%",
                // 카드 높이를 일정하게 유지 (여유 있는 고정 높이)
                height: 520,
                overflow: "auto",
                border: "1px solid #666",
                borderRadius: 12,
                padding: 20,
                background: "white",
                boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ marginBottom: 10, fontSize: 13, color: "#666" }}>
                문제 {i + 1} / {problems.length} · ID {p.id}
              </div>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 12,
                  lineHeight: 1.35,
                  whiteSpace: "pre-wrap",
                }}
              >
                {prompt}
              </h3>

              <form onSubmit={(e) => onSubmit(e, p, i)}>
                <div style={{ margin: "8px 0 12px" }}>{inputFor(p)}</div>
                <button disabled={!!grading[p.id]} type="submit" style={{ padding: "8px 12px" }}>
                  {grading[p.id] ? "채점 중..." : "제출"}
                </button>
              </form>

              {results[p.id] && (
                <p style={{ marginTop: 10 }}>
                  점수: {results[p.id].score} / 1{" "}
                  {results[p.id].feedback
                    ? `— ${results[p.id].feedback}`
                    : results[p.id].score
                    ? "정답"
                    : "오답"}
                </p>
              )}
            </div>
          </section>
        );
      }),
    [renderable, grading, results, answers]
  );

  return (
    <>
      <TopRight />
      <div
        ref={viewportRef}
        style={{
          // 고정 뷰포트: 한 화면에 한 카드만
          height: "100vh",
          overflowY: "auto",
          scrollSnapType: "y mandatory",
          background: "linear-gradient(180deg,#f8fafc 0%, #ffffff 30%)",
        }}
      >
        <header style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 0" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
            온라인 실습 교재 — Chapter 1
          </h1>
          <p style={{ color: "#555", marginBottom: 8 }}>
            스크롤은 현재 문제까지만 가능하며, 정답을 제출하면 다음 문제가 열립니다.
          </p>
        </header>

        {loadingProblems ? (
          <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            문제를 불러오는 중…
          </div>
        ) : problems.length === 0 ? (
          <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            등록된 문제가 없습니다.
          </div>
        ) : (
          <main>{Sections}</main>
        )}
      </div>
    </>
  );
}
