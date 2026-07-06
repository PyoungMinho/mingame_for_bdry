"use client";

// 오후의 패 — 실시간 방 훅. 익명 로그인 → 입장 → rooms/players/hands 구독 → 액션 API.
import { useState, useEffect, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, ensureAnonUid } from "@/lib/pae/supabase";
import type { PublicState } from "@/lib/pae/room-state";
import type { Tile } from "@/lib/pae/tiles";

export interface Member {
  uid: string;
  name: string;
  seat: number;
}

export interface UseRoom {
  status: string;
  hostUid: string | null;
  publicState: PublicState | null;
  members: Member[];
  myHand: Tile[];
  myUid: string | null;
  error: string | null;
  start: () => Promise<void>;
  restart: () => Promise<void>;
  leave: () => Promise<void>;
  play: (tiles: Tile[]) => Promise<string | null>;
  pass: () => Promise<string | null>;
}

export function useRoom(code: string, myName: string): UseRoom {
  const [status, setStatus] = useState("waiting");
  const [hostUid, setHostUid] = useState<string | null>(null);
  const [publicState, setPublicState] = useState<PublicState | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myHand, setMyHand] = useState<Tile[]>([]);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uidRef = useRef<string | null>(null);
  const statusRef = useRef<string>("waiting"); // cleanup 시점에 최신 상태 참조용

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

  const refresh = useCallback(async () => {
    const sb = getSupabase();
    const uid = uidRef.current;
    if (!sb || !uid) return;
    const [{ data: room }, { data: mem }, { data: hand }] = await Promise.all([
      sb.from("rooms").select("status,host_uid,public_state").eq("code", code).single(),
      sb.from("room_players").select("uid,name,seat").eq("room_code", code).order("seat"),
      sb.from("hands").select("tiles").eq("room_code", code).eq("uid", uid).maybeSingle(),
    ]);
    if (room) {
      setStatus(room.status as string);
      statusRef.current = room.status as string;
      setHostUid((room.host_uid as string) ?? null);
      setPublicState((room.public_state as PublicState | null) ?? null);
    }
    setMembers((mem ?? []).map((m) => ({ uid: m.uid as string, name: m.name as string, seat: m.seat as number })));
    setMyHand(((hand?.tiles as Tile[]) ?? []));
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
        .subscribe();
    })();
    return () => {
      alive = false;
      if (channel) sb.removeChannel(channel);
      // 대기 중 언마운트면 best-effort로 자리 비우기(playing/ended면 서버가 무시).
      if (statusRef.current === "waiting") void api(`/api/pae/rooms/${code}/leave`, {});
    };
  }, [code, myName, api, refresh]);

  // Realtime 이벤트를 놓치는 경우 대비 — 2초마다 폴링해 턴/손패/상태 갱신을 보장.
  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  const start = useCallback(async () => {
    const e = await api(`/api/pae/rooms/${code}/start`, {});
    if (e) setError(e);
  }, [api, code]);
  const restart = useCallback(async () => {
    const e = await api(`/api/pae/rooms/${code}/restart`, {});
    if (e) setError(e);
  }, [api, code]);
  const leave = useCallback(async () => {
    const e = await api(`/api/pae/rooms/${code}/leave`, {});
    if (e) setError(e);
  }, [api, code]);
  const play = useCallback(
    async (tiles: Tile[]) => {
      const e = await api(`/api/pae/rooms/${code}/action`, { action: "play", tiles });
      if (!e) await refresh(); // 낸 직후 내 화면 즉시 갱신(다음 사람 턴도 곧 폴링/Realtime로 따라옴)
      return e;
    },
    [api, code, refresh],
  );
  const pass = useCallback(
    async () => {
      const e = await api(`/api/pae/rooms/${code}/action`, { action: "pass" });
      if (!e) await refresh();
      return e;
    },
    [api, code, refresh],
  );

  return { status, hostUid, publicState, members, myHand, myUid, error, start, restart, leave, play, pass };
}
