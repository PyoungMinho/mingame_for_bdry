"use client";

// 오후의 패 — 실시간 방. 대기방(멤버 실시간) → 방장이 시작하면 RealtimeGame.
import { useState } from "react";
import { useRoom } from "@/lib/pae/useRoom";
import RealtimeGame from "@/components/pae/RealtimeGame";

export default function RealtimeRoom({ code, myName }: { code: string; myName: string }) {
  const room = useRoom(code, myName);
  const [copied, setCopied] = useState(false);
  const isHost = !!room.hostUid && !!room.myUid && room.hostUid === room.myUid;
  const exit = () => {
    if (typeof window !== "undefined") window.location.href = "/pae";
  };
  // 대기방에서 나가기 — 자리를 비우고(waiting이면) 로비로 복귀.
  const leaveLobby = async () => {
    await room.leave();
    exit();
  };

  if ((room.status === "playing" || room.status === "ended") && room.publicState) {
    return <RealtimeGame room={room} code={code} onExit={exit} />;
  }

  const copy = () => {
    if (typeof window === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="lobby">
      <div className="code-box">
        <div className="code-lbl">방 코드</div>
        <div className="code">{code}</div>
        <button className="ghost copy" onClick={copy}>링크 복사</button>
        <div className="copied">{copied ? "복사됐어요!" : room.error ?? ""}</div>
      </div>

      <div className="members">
        {room.members.map((m, i) => (
          <div key={m.uid} className={`seat ${m.uid === room.myUid ? "me" : ""}`}>
            <div className={`ava c${i}`}>{m.name[0]}</div>
            <div className="nm">{m.name}</div>
            <div className="role">
              {m.uid === room.hostUid ? "방장" : "대기 중"}
              {m.uid === room.myUid ? " · 나" : ""}
            </div>
          </div>
        ))}
      </div>

      {isHost ? (
        <button className="play start" onClick={() => room.start()} disabled={room.members.length < 3}>
          게임 시작
        </button>
      ) : (
        <div className="hint">방장이 시작하길 기다리는 중…</div>
      )}
      <div className="hint">{room.members.length}명 입장 · 3인 이상이면 시작할 수 있어요</div>
      <button className="ghost" onClick={leaveLobby}>나가기</button>
    </div>
  );
}
