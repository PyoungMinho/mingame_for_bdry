"use client";

// 오후의 패 — 실시간 방 훅. 익명 로그인 → 입장 → rooms/players/hands 구독 + 채팅 broadcast.
// 속도: 액션은 서버 응답의 최신 상태로 즉시 반영(refresh 왕복 없음) + Realtime 놓침 대비 1초 폴링.
// 정합: 액션 낙관 반영을 뒤늦게 착지한 stale 폴링이 되돌리지 못하도록 액션 시퀀스로 가드.
import { useState, useEffect, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, ensureAnonUid } from "@/lib/pae/supabase";
import type { PublicState } from "@/lib/pae/room-state";
import type { Tile } from "@/lib/pae/tiles";

export interface Member {
  uid: string;
  name: string;
  seat: number;
  ready: boolean;
}

/** 잠깐 떴다 사라지는 채팅 말풍선 (저장 안 함) */
export interface Bubble {
  seat: number;
  text: string;
  key: number;
}

export interface UseRoom {
  status: string;
  hostUid: string | null;
  publicState: PublicState | null;
  members: Member[];
  myHand: Tile[];
  myUid: string | null;
  error: string | null;
  bubbles: Bubble[];
  start: (rounds?: number) => Promise<void>;
  restart: () => Promise<void>;
  leave: () => Promise<void>;
  play: (tiles: Tile[]) => Promise<string | null>;
  pass: () => Promise<string | null>;
  sendChat: (text: string) => void;
  sendReady: (ready: boolean) => Promise<void>;
  awaySeats: number[];
}

/** 이 시간(ms) 이상 heartbeat 없으면 자리비움으로 표시 (서버 tick과 동일 기준). */
const AWAY_MS = 20000;

export function useRoom(code: string, myName: string): UseRoom {
  const [status, setStatus] = useState("waiting");
  const [hostUid, setHostUid] = useState<string | null>(null);
  const [publicState, setPublicState] = useState<PublicState | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myHand, setMyHand] = useState<Tile[]>([]);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [awaySeats, setAwaySeats] = useState<number[]>([]);
  const uidRef = useRef<string | null>(null);
  const statusRef = useRef<string>("waiting");
  const mySeatRef = useRef<number>(-1); // sendChat이 내 seat를 알기 위해
  const seatCountRef = useRef<number>(0); // broadcast 수신 seat 범위 검증용
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false); // 구독 완료 전 채팅 전송 거짓 성공 방지
  const bubbleKey = useRef(0);
  const bubbleTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // 액션 시퀀스: 낙관적 반영마다 증가. 읽는 도중 값이 바뀐 폴링은 stale이므로 폐기.
  const actionSeqRef = useRef(0);

  // 같은 seat의 이전 말풍선은 교체(최신 1개), 4초 뒤 자동 제거. 타이머는 언마운트 시 정리.
  const addBubble = useCallback((seat: number, text: string) => {
    const key = ++bubbleKey.current;
    setBubbles((prev) => [...prev.filter((b) => b.seat !== seat), { seat, text, key }]);
    const timer = setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.key !== key));
      bubbleTimers.current.delete(timer);
    }, 4000);
    bubbleTimers.current.add(timer);
  }, []);

  // 언마운트 시 살아있는 말풍선 타이머 일괄 정리 (setState-after-unmount / 누수 방지)
  useEffect(() => {
    const timers = bubbleTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const api = useCallback(async (path: string, body: unknown): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb) return "Supabase 미설정";
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return j.error ?? "요청 실패";
    }
    return null;
  }, []);

  const applyPublic = useCallback((pub: PublicState | null, uid: string | null) => {
    setPublicState(pub);
    if (pub) {
      setStatus(pub.phase === "playing" || pub.phase === "ended" ? pub.phase : "waiting");
      seatCountRef.current = pub.players.length;
      if (uid) mySeatRef.current = pub.players.findIndex((p) => p.id === uid);
    }
  }, []);

  const refresh = useCallback(async () => {
    const sb = getSupabase();
    const uid = uidRef.current;
    if (!sb || !uid) return;
    const seqAtStart = actionSeqRef.current;
    const [{ data: room }, { data: mem }, { data: hand }] = await Promise.all([
      sb.from("rooms").select("status,host_uid,public_state").eq("code", code).single(),
      sb.from("room_players").select("uid,name,seat,last_seen,ready").eq("room_code", code).order("seat"),
      sb.from("hands").select("tiles").eq("room_code", code).eq("uid", uid).maybeSingle(),
    ]);
    // 읽는 동안 내 액션이 났으면(낙관 반영이 더 최신) 이 폴링 결과는 폐기 — 되돌림 방지.
    if (actionSeqRef.current !== seqAtStart) return;
    if (room) {
      setStatus(room.status as string);
      statusRef.current = room.status as string;
      setHostUid((room.host_uid as string) ?? null);
      const pub = (room.public_state as PublicState | null) ?? null;
      setPublicState(pub);
      if (pub) {
        seatCountRef.current = pub.players.length;
        if (uid) mySeatRef.current = pub.players.findIndex((p) => p.id === uid);
      }
    }
    setMembers((mem ?? []).map((m) => ({ uid: m.uid as string, name: m.name as string, seat: m.seat as number, ready: (m.ready as boolean) ?? false })));
    setMyHand((hand?.tiles as Tile[]) ?? []);
    const now = Date.now();
    setAwaySeats(
      (mem ?? [])
        .filter((m) => now - new Date(m.last_seen as string).getTime() > AWAY_MS)
        .map((m) => m.seat as number),
    );
  }, [code]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let alive = true;
    let channel: RealtimeChannel | null = null;
    (async () => {
      const uid = await ensureAnonUid();
      if (!alive) return;
      uidRef.current = uid;
      setMyUid(uid);
      const err = await api(`/api/pae/rooms/${code}/join`, { name: myName });
      if (err) setError(err);
      await refresh();
      channel = sb
        .channel(`room-${code}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, () => refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_code=eq.${code}` }, () => refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "hands", filter: `room_code=eq.${code}` }, () => refresh())
        .on("broadcast", { event: "chat" }, ({ payload }) => {
          // 송신 측을 신뢰하지 않고 수신부에서 재검증·재클립 (변조 클라이언트 방어)
          const p = payload as { seat?: unknown; text?: unknown };
          if (typeof p?.seat !== "number" || !Number.isInteger(p.seat)) return;
          if (typeof p?.text !== "string") return;
          const text = p.text.trim().slice(0, 40);
          if (!text) return;
          const max = seatCountRef.current || 4;
          if (p.seat < 0 || p.seat >= max) return;
          addBubble(p.seat, text);
        })
        .subscribe((st) => {
          subscribedRef.current = st === "SUBSCRIBED";
        });
      channelRef.current = channel;
    })();
    return () => {
      alive = false;
      subscribedRef.current = false;
      if (channel) sb.removeChannel(channel);
      channelRef.current = null;
      if (statusRef.current === "waiting") void api(`/api/pae/rooms/${code}/leave`, {});
    };
  }, [code, myName, api, refresh, addBubble]);

  // Realtime 이벤트 놓침 대비 — 1초 폴링으로 턴/손패/상태 갱신 보장.
  useEffect(() => {
    const id = setInterval(() => void refresh(), 1000);
    return () => clearInterval(id);
  }, [refresh]);

  // 게임 중 heartbeat + 자리비움 좌석 자동진행 트리거(3초). 응답의 최신 공개상태를 즉시 반영.
  const tick = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch(`/api/pae/rooms/${code}/tick`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const j = (await res.json().catch(() => ({}))) as { publicState?: PublicState | null };
    if (j.publicState) {
      actionSeqRef.current++; // 자동진행 결과가 stale 폴링에 덮이지 않게
      applyPublic(j.publicState, uidRef.current);
    }
  }, [code, applyPublic]);

  // heartbeat tick — 대기방·결과화면 포함 항상 돌려 last_seen을 최신 유지(라운드 전환 시 stale 방지).
  // tick 라우트가 playing이 아니면 heartbeat만 하고 자동진행은 건너뛴다.
  useEffect(() => {
    const id = setInterval(() => void tick(), 3000);
    return () => clearInterval(id);
  }, [tick]);

  const start = useCallback(
    async (rounds?: number) => {
      const e = await api(`/api/pae/rooms/${code}/start`, { rounds });
      if (e) setError(e);
    },
    [api, code],
  );
  const restart = useCallback(async () => {
    const e = await api(`/api/pae/rooms/${code}/restart`, {});
    if (e) setError(e);
  }, [api, code]);
  const leave = useCallback(async () => {
    const e = await api(`/api/pae/rooms/${code}/leave`, {});
    if (e) setError(e);
  }, [api, code]);
  const sendReady = useCallback(
    async (ready: boolean) => {
      const e = await api(`/api/pae/rooms/${code}/ready`, { ready });
      if (e) setError(e);
    },
    [api, code],
  );

  // 액션: 서버 응답의 최신 공개상태 + 본인 손패를 즉시 반영(조회 왕복 제거 → 빠름).
  const actionCall = useCallback(
    async (body: { action: string; tiles?: Tile[] }): Promise<string | null> => {
      const sb = getSupabase();
      if (!sb) return "Supabase 미설정";
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(`/api/pae/rooms/${code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; publicState?: PublicState; myHand?: Tile[] };
      if (!res.ok) {
        // 내 화면이 stale이라 거부됐을 수 있음(이미 턴이 넘어갔는데 아직 내 차례로 보임 등)
        // → 서버 최신 상태로 즉시 재동기화해 턴/버튼을 교정한다.
        void refresh();
        return j.error ?? "요청 실패";
      }
      // 낙관적 반영 — 이후 이 시점 이전에 시작된 stale 폴링이 되돌리지 못하게 시퀀스 증가.
      actionSeqRef.current++;
      if (j.publicState) applyPublic(j.publicState, uidRef.current);
      if (j.myHand) setMyHand(j.myHand);
      return null;
    },
    [code, applyPublic, refresh],
  );
  const play = useCallback((tiles: Tile[]) => actionCall({ action: "play", tiles }), [actionCall]);
  const pass = useCallback(() => actionCall({ action: "pass" }), [actionCall]);

  const sendChat = useCallback(
    (text: string) => {
      const t = text.trim().slice(0, 40);
      if (!t) return;
      const seat = mySeatRef.current;
      if (seat < 0) return;
      const ch = channelRef.current;
      // 아직 구독 안 된 채널로는 전송이 상대에게 안 가므로 내 말풍선도 띄우지 않음(거짓 성공 방지).
      if (!ch || !subscribedRef.current) return;
      void ch.send({ type: "broadcast", event: "chat", payload: { seat, text: t } });
      addBubble(seat, t); // 연결된 상태에서만 내 말풍선 즉시 표시
    },
    [addBubble],
  );

  return { status, hostUid, publicState, members, myHand, myUid, error, bubbles, start, restart, leave, play, pass, sendChat, sendReady, awaySeats };
}
