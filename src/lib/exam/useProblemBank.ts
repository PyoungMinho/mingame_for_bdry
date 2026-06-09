"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BankItem, Variant } from "./types";

const KEY = "munje-factory:bank:v1";

/** 저장 시도 결과 — added(추가된 문항 수) / ok(디스크 영속화 성공 여부) */
export type BankAddResult = { added: number; ok: boolean };

function read(): BankItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BankItem[]) : [];
  } catch {
    return [];
  }
}

/** 영속화 성공 시 true. 용량 초과(QuotaExceeded) 등 실패 시 false → 호출부에서 롤백 판단 */
function write(items: BankItem[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

/** 문제은행 — localStorage 영속화. 서버/계정 연동은 추후 교체 지점. */
export function useProblemBank() {
  const [items, setItems] = useState<BankItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  // 메모리 상태의 동기 미러 — add가 setItems 콜백 밖에서 최신값을 읽고 반환값을 즉시 결정하기 위함
  const itemsRef = useRef<BankItem[]>([]);

  useEffect(() => {
    const initial = read();
    itemsRef.current = initial;
    setItems(initial);
    setLoaded(true);
  }, []);

  /**
   * 변형 문항을 은행에 저장한다. 디스크 쓰기를 메모리 갱신보다 '먼저' 수행하고,
   * 실패하면 메모리(ref·state)를 건드리지 않아 메모리-디스크 불일치(데이터 유실 착시)를 차단한다.
   * 반환값으로 토스트(성공/중복/용량초과)를 분기한다.
   */
  const add = useCallback((variants: Variant[]): BankAddResult => {
    const prev = itemsRef.current;
    const existing = new Set(prev.map((p) => p.id));
    const additions: BankItem[] = variants
      .filter((v) => !existing.has(v.id))
      .map((v) => ({ ...v, savedAt: Date.now() }));
    if (!additions.length) return { added: 0, ok: true };

    const next = [...additions, ...prev];
    if (!write(next)) return { added: 0, ok: false }; // 롤백 — 메모리 미반영
    itemsRef.current = next;
    setItems(next);
    return { added: additions.length, ok: true };
  }, []);

  const remove = useCallback((id: string) => {
    const next = itemsRef.current.filter((p) => p.id !== id);
    itemsRef.current = next;
    write(next);
    setItems(next);
  }, []);

  const clear = useCallback(() => {
    itemsRef.current = [];
    write([]);
    setItems([]);
  }, []);

  return { items, loaded, add, remove, clear };
}
