"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/`
            : undefined,
      },
    });
    if (error) setErr(error.message);
    else setSent(true);
  };

  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
      <h1>로그인</h1>
      <p>이메일로 로그인 링크(매직 링크)를 보내드립니다.</p>
      <form onSubmit={sendMagicLink} style={{ marginTop: 16 }}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 8 }}
        />
        <button type="submit" style={{ padding: "8px 12px" }}>
          로그인 링크 보내기
        </button>
      </form>
      {sent && <p style={{ marginTop: 12 }}>이메일을 확인하세요. (스팸함도 확인)</p>}
      {err && <p style={{ marginTop: 12, color: "red" }}>{err}</p>}
    </main>
  );
}
