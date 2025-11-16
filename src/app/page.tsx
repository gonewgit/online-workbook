"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Problem = {
  id: number;
  chapter_id: number;
  type: string;          // 'short' | 'essay' | 'mcq' | 'numeric'
  body: string;
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

export default function Home() {
  // 로그인/권한
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isEntitled, setIsEntitled] = useState<boolean | null>(null);

  // 문제
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(true);

  // 답안/결과 상태
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [grading, setGrading] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<Record<number, GradeRes>>({});

  // 현재 뷰 인덱스
  const [activeIdx, setActiveIdx] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]); // ✅ 타입 명시

  // -------------- 로그인 & 수강권 확인 --------------
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

  // -------------- 문제 불러오기 --------------
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingProblems(true);
        const res = await fetch("/api/problems?chapter=1", { cache: "no-store" });
        if (!res.ok) throw new Error("failed to load problems");
        const data = (await res.json()) as Problem[];
        setProblems(data);
      } finally {
        setLoadingProblems(false);
      }
    };
    load();
  }, []);

  // -------------- 인터섹션으로 현재 섹션 감지 --------------
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]) {
          const idx = Number((vis[0].target as HTMLElement).dataset.index || "0");
          setActiveIdx(idx);
        }
      },
      { threshold: [0.25, 0.5, 0.75, 0.9] }
    );

    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [problems.length]);

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

  // ------------ 상태별 가림막 ------------
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

  // ------------ 문제 카드 렌더 ------------
  const onSubmit = async (e: React.FormEvent, p: Problem) => {
    e.preventDefault();
    const ans = answers[p.id] ?? "";
    setGrading((g) => ({ ...g, [p.id]: true }));
    try {
      const res = await grade(p.id, ans);
      setResults((r) => ({ ...r, [p.id]: res }));
    } finally {
      setGrading((g) => ({ ...g, [p.id]: false }));
    }
  };

  // 스타일 헬퍼: 이전 카드의 희미도/그라데이션
  const cardStyle = (idx: number): React.CSSProperties => {
    if (idx < activeIdx - 1) {
      // 현재보다 2개 이상 이전: 더 희미
      return {
        opacity: 0.18,
        filter: "grayscale(60%)",
        transition: "opacity 200ms ease, filter 200ms ease",
      };
    }
    if (idx === activeIdx - 1) {
      // 바로 직전 카드: 옅게 + 그라데이션
      return {
        position: "relative",
        opacity: 0.45,
        filter: "grayscale(30%)",
        transition: "opacity 200ms ease, filter 200ms ease",
        background:
          "linear-gradient(to bottom, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.7) 60%, rgba(255,255,255,0.9) 100%)",
      };
    }
    // 현재/이후: 선명
    return { opacity: 1, filter: "none", transition: "opacity 200ms ease" };
  };

  const inputFor = (p: Problem) => {
    const mode = (p.grading_mode || p.type || "short").toLowerCase();
    const val = answers[p.id] ?? "";
    const set = (v: string) => setAnswers((a) => ({ ...a, [p.id]: v }));

    if (mode === "essay") {
      return (
        <textarea
          placeholder="서술형 답안을 입력하세요"
          value={val}
          onChange={(e) => set(e.target.value)}
          style={{ width: "100%", minHeight: 140, padding: 12 }}
        />
      );
    }
    // 기본: 단답형/숫자형
    return (
      <input
        type="text"
        placeholder="답안을 입력하세요"
        value={val}
        onChange={(e) => set(e.target.value)}
        style={{ width: "100%", padding: 10 }}
      />
    );
  };

  const Sections = useMemo(
    () =>
      problems.map((p, i) => (
        <section
          key={p.id}
          data-index={i}
          ref={(el: HTMLElement | null) => {
            // ✅ ref 콜백은 반드시 void를 반환하도록 블록 사용
            sectionRefs.current[i] = el;
          }}
          style={{
            scrollSnapAlign: "start",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            padding: "48px 16px",
          }}
        >
          <div
            style={{
              ...cardStyle(i),
              maxWidth: 900,
              width: "100%",
              margin: "0 auto",
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
              }}
              dangerouslySetInnerHTML={{
                __html: p.body.replace(/\n/g, "<br/>"),
              }}
            />
            <form onSubmit={(e) => onSubmit(e, p)}>
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
      )),
    [problems, grading, results, activeIdx, answers]
  );

  return (
    <>
      <TopRight />
      <div
        style={{
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
            스크롤하여 한 문제씩 풀어보세요. 직전 문제는 희미하게 보이고, 더 이전은 더 희미합니다.
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
