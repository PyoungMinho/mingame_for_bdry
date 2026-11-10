'use client';

/**
 * 화면 폭·화면 키보드 (방향서 §5-5, 디자인 §4-4·A7).
 *  - useIsMobile: 창 안쪽 폭 1024px 미만 = 모바일 배치(창 1개 + 시트 탭 전환). 서버 렌더는 PC로 본다
 *    (GameScreen은 마운트 뒤에만 그리므로 하이드레이션 차이 없음).
 *  - useKeyboardOffset: visualViewport 아래 끝과 레이아웃 뷰포트 아래 끝의 차이(= 화면 키보드 높이).
 *    80px 이하이면 키보드가 아닌 것으로 보고 null. 시트 탭 줄을 키보드 바로 위에 붙이는 데 쓴다.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

export const MOBILE_QUERY = '(max-width: 1023px)';

function subscribeMedia(cb: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener?.('change', cb);
  window.addEventListener('resize', cb);
  return () => {
    mq.removeEventListener?.('change', cb);
    window.removeEventListener('resize', cb);
  };
}

function mobileNow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribeMedia, mobileNow, () => false);
}

/** 키보드 높이 계산(순수 함수, 테스트용) */
export function keyboardOffsetOf(innerHeight: number, vv: { height: number; offsetTop: number } | null): number | null {
  if (!vv) return null;
  const gap = Math.round(innerHeight - (vv.height + vv.offsetTop));
  return gap > 80 ? gap : null;
}

export function useKeyboardOffset(enabled: boolean): number | null {
  const [offset, setOffset] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.visualViewport) {
      setOffset(null);
      return;
    }
    const vv = window.visualViewport;
    const update = () => setOffset(keyboardOffsetOf(window.innerHeight, vv));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);
  return offset;
}
