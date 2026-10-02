'use client';

/**
 * 개인 추리 수첩(개선 묶음 1 · R4) 상태 + 영속화(`gu:note:v1`). 순수 파서·저장 규약은 src/lib/gung/notes.ts.
 *
 *  - (code, seat) 가 바뀌면 다시 읽는다 — 다른 방·다른 자리의 저장은 notes.loadNote 가 지운다(자리 바꾸기·새 방).
 *  - localStorage 가 막히면(시크릿·차단) openStorage 의 메모리 폴백으로 이 탭 안에서만 산다 — 앱은 죽지 않는다.
 *  - 이 훅은 게임 상태를 받지 않는다 — 카드 열람·단계 진행이 칸에 닿을 길이 없다(자동 추론 금지).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type GungNote,
  type NoteCol,
  type StorageLike,
  clearNote,
  cycleMark,
  emptyNote,
  loadNote,
  openStorage,
  saveNote,
  setFree,
  setLine,
} from '@/lib/gung';

export interface UseGungNotes {
  note: GungNote | null;
  cycle: (seat: number, col: NoteCol) => void;
  line: (seat: number, text: string) => void;
  free: (text: string) => void;
  clear: () => void;
}

export function useGungNotes(code: string | null, seat: number | null): UseGungNotes {
  const storageRef = useRef<StorageLike | null>(null);
  const [note, setNote] = useState<GungNote | null>(null);

  const storage = () => {
    if (!storageRef.current) storageRef.current = openStorage().storage;
    return storageRef.current;
  };

  useEffect(() => {
    if (!code || !seat) {
      setNote(null);
      return;
    }
    const now = Date.now();
    setNote(loadNote(storage(), now, { code, seat }) ?? emptyNote(code, seat, now));
  }, [code, seat]);

  const update = useCallback((fn: (n: GungNote, now: number) => GungNote) => {
    setNote((prev) => {
      if (!prev) return prev;
      const next = fn(prev, Date.now());
      saveNote(storage(), next);
      return next;
    });
  }, []);

  const cycle = useCallback((s: number, col: NoteCol) => update((n, now) => cycleMark(n, s, col, now)), [update]);
  const line = useCallback((s: number, text: string) => update((n, now) => setLine(n, s, text, now)), [update]);
  const free = useCallback((text: string) => update((n, now) => setFree(n, text, now)), [update]);
  const clear = useCallback(() => {
    clearNote(storage());
    setNote((prev) => (prev ? emptyNote(prev.code, prev.seat, Date.now()) : prev));
  }, []);

  return { note, cycle, line, free, clear };
}
