"use client";

import { useEffect, useState } from "react";
import type { SocialProofConfig } from "./types";

/**
 * 사회적 증거 참여자 수 (design-final §1-0: localStorage `oa-count` 누적, 없으면 정적 카피).
 * config.json.socialProof.baseCount 위에 이 브라우저에서 완료한 테스트 횟수(oa-count)를
 * 더해서 보여준다 — 서버 집계가 아니라 "느낌"용 순수 클라이언트 연출(DB/API 0 원칙).
 */
export function useSocialProofCount(config?: SocialProofConfig): number {
  const [count, setCount] = useState(config?.baseCount ?? 0);

  useEffect(() => {
    if (!config) return;
    try {
      const raw = window.localStorage.getItem(config.storageKey);
      const local = raw ? parseInt(raw, 10) : 0;
      setCount(config.baseCount + (Number.isFinite(local) ? local : 0));
    } catch {
      setCount(config.baseCount);
    }
  }, [config]);

  return count;
}

/** 테스트 완료 시 1회 호출 — localStorage 누적 카운터 +1 (design-final §1-0). */
export function incrementSocialProofCount(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const local = raw ? parseInt(raw, 10) : 0;
    window.localStorage.setItem(storageKey, String((Number.isFinite(local) ? local : 0) + 1));
  } catch {
    // 실패해도 테스트 흐름에는 영향 없음
  }
}
