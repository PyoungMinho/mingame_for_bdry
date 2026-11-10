'use client';

/**
 * 실전 방 훅 (UseLiveRoom 시그니처). 모든 로직은 LiveRoom 클래스에 있고 이 훅은 구독·수명만 맡는다.
 * 화면이 사라질 때 자동 leave 하지 않는다(방향서 §4-7). 탭이 다시 보이면 즉시 sync한다.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ViewState } from '../protocol';
import type { RoomController } from './controller';
import { subscribeBell } from './bell';
import { LiveRoom } from './liveRoom';

/**
 * @param firstSyncView 첫 sync에만 보고할 화면 상태(새로고침이면 숨김으로 시작 — 첫 응답을 기다리는 동안에도 서버가 'game'으로 보지 않게)
 */
export function useMcRoom(code: string, getView: () => ViewState, firstSyncView?: () => ViewState): RoomController {
  const ref = useRef<{ code: string; room: LiveRoom } | null>(null);
  if (!ref.current || ref.current.code !== code) {
    ref.current = { code, room: new LiveRoom(code, { getView, firstSyncView, subscribeBell }) };
  }
  const room = ref.current.room;
  const controller = useSyncExternalStore(
    room.subscribe,
    () => {
      // state가 바뀌었을 때만 새 객체
      const c = room.controller();
      return c;
    },
    () => room.controller(),
  );

  useEffect(() => {
    room.start();
    const onVisible = () => {
      if (document.visibilityState === 'visible') room.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      room.dispose();
    };
  }, [room]);

  return controller;
}
