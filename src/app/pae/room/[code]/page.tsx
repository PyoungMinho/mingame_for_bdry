"use client";

// 오후의 패 — 방 페이지. 키가 있으면 실시간(RealtimeRoom), 없으면 봇 데모로 폴백.
import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SUPABASE_READY } from "@/lib/pae/supabase";
import RealtimeRoom from "@/components/pae/RealtimeRoom";
import GameTable from "@/components/pae/GameTable";

const BOTS = ["준봇", "민봇", "수봇"];

export default function Room() {
  const params = useParams();
  const sp = useSearchParams();
  const code = String(params.code ?? "").toUpperCase();
  const myName = sp.get("name") || "나";

  if (SUPABASE_READY) return <RealtimeRoom code={code} myName={myName} />;
  return <BotLobby code={code} myName={myName} />;
}

// 실시간 미설정 시 폴백 — 봇 3명과 데모.
function BotLobby({ code, myName }: { code: string; myName: string }) {
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);

  if (started) return <GameTable myName={myName} onExit={() => setStarted(false)} />;

  const copy = () => {
    if (typeof window === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  const seats = [
    { name: myName, role: "방장 · 나", me: true },
    ...BOTS.map((b) => ({ name: b, role: "대기 중", me: false })),
  ];

  return (
    <div className="lobby">
      <div className="code-box">
        <div className="code-lbl">방 코드</div>
        <div className="code">{code}</div>
        <button className="ghost copy" onClick={copy}>링크 복사</button>
        <div className="copied">{copied ? "복사됐어요!" : ""}</div>
      </div>
      <div className="members">
        {seats.map((s, i) => (
          <div key={i} className={`seat ${s.me ? "me" : ""}`}>
            <div className={`ava c${i}`}>{s.name[0]}</div>
            <div className="nm">{s.name}</div>
            <div className="role">{s.role}</div>
          </div>
        ))}
      </div>
      <button className="play start" onClick={() => setStarted(true)}>게임 시작</button>
      <div className="hint">실시간 멀티 연결 전이라 지금은 봇 3명과 데모로 시작합니다.</div>
    </div>
  );
}
