'use client';

/**
 * 연습 훅 (UsePracticeRoom 시그니처 + 박대리 도발 필드). 같은 컨트롤러 인터페이스로 실전과 같은 화면 한 벌을 쓴다.
 * 250ms마다 세션 시간 진행(tick). 화면이 사라질 때 아무것도 하지 않는다.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { IndustryId } from '../constants';
import { COMMON_PACK } from '../copy/pick';
import { createPracticeController, type PracticeController, type PracticeControllerHandle } from './practiceController';
import { PracticeSession } from './practiceSession';

export function usePracticeRoom(industry: IndustryId = 0, nickname?: string): PracticeController {
  const ref = useRef<PracticeControllerHandle | null>(null);
  if (!ref.current) {
    ref.current = createPracticeController(new PracticeSession({ industry, nickname, partnerName: COMMON_PACK.practice.partnerName }));
  }
  const handle = ref.current;
  const controller = useSyncExternalStore(handle.subscribe, handle.get, handle.get);
  useEffect(() => {
    const id = window.setInterval(() => handle.session.tick(), 250);
    return () => window.clearInterval(id);
  }, [handle]);
  return controller;
}
