"use client";

// 오후의 패 — 랜딩. 방 만들기 / 코드로 입장 + 게임 방법·족보 모달.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUPABASE_READY, getSupabase, ensureAnonUid } from "@/lib/pae/supabase";
import RulesModal from "@/components/pae/RulesModal";

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0·O·1·I 제외
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

const DECO = [
  { n: 2, s: "sun", x: "6%", y: "0px", r: "-12deg", d: "0s" },
  { n: 9, s: "cloud", x: "84%", y: "-18px", r: "11deg", d: ".6s" },
  { n: 7, s: "moon", x: "90%", y: "84px", r: "16deg", d: "1.1s" },
  { n: 13, s: "star", x: "0%", y: "96px", r: "-9deg", d: ".3s" },
];

export default function Landing() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const create = async () => {
    const nm = name || "나";
    if (!SUPABASE_READY) {
      router.push(`/pae/room/${randomCode()}?host=1&name=${encodeURIComponent(nm)}`);
      return;
    }
    setBusy(true);
    const sb = getSupabase();
    await ensureAnonUid();
    const { data } = await sb!.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch("/api/pae/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ name: nm }),
    });
    const j = (await res.json().catch(() => ({}))) as { code?: string };
    setBusy(false);
    if (j.code) router.push(`/pae/room/${j.code}?name=${encodeURIComponent(nm)}`);
  };

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length >= 4) router.push(`/pae/room/${c}?name=${encodeURIComponent(name || "나")}`);
  };

  return (
    <div className="landing">
      <div className="deco">
        {DECO.map((t, i) => (
          <div
            key={i}
            className={`deco-tile ${t.s}`}
            style={{ left: t.x, top: t.y, animation: `floaty 5s ease-in-out ${t.d} infinite`, ["--r" as never]: t.r }}
          >
            <svg viewBox="0 0 24 24"><use href={`#d-${t.s}`} /></svg>
          </div>
        ))}
      </div>

      <h1>오후의 패 <b>牌</b></h1>
      <p className="sub">점심 먹고 한 판. <span className="accent">가입 없이, 5분.</span></p>

      <div className="panel">
        <div className="name-row">
          <input
            className="inp"
            placeholder="닉네임 (예: 민호)"
            value={name}
            maxLength={8}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="play" onClick={create} disabled={busy}>
          {busy ? "방 만드는 중…" : "방 만들기"}
        </button>
        <div className="divider">또는 코드로 입장</div>
        <div className="join">
          <input
            className="inp code"
            placeholder="ABZ42"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
          <button className="pass" onClick={join}>입장</button>
        </div>
      </div>

      <button className="link-btn" onClick={() => setShowRules(true)}>📖 게임 방법 &amp; 족보 보기</button>
      <div className="rules">3~5인 · 색 <b>해 › 달 › 별 › 구름</b> · 숫자 <b>3 ‹ … ‹ 15 ‹ 1 ‹ 2</b></div>

      <RulesModal open={showRules} onClose={() => setShowRules(false)} />
    </div>
  );
}
