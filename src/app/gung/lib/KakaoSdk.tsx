'use client';

/**
 * §8-1 카카오 SDK 준비 — 공유 버튼이 눌리는 "그 탭" 안에서 동기로 Kakao.Share.sendDefault 를 부를 수 있도록,
 * 화면이 열렸을 때 미리 `loadKakaoSdk()`를 불러 둔다(탭 핸들러 안에서 await 하지 않음 — share.ts 주석).
 * 엔진 보고 결정: 스펙의 "공유 버튼 안에서 최대 3초 대기"는 탭으로 안 쳐질 수 있어 폐기했고,
 * 이 컴포넌트가 화면 진입 시 미리 로드해 두는 쪽으로 옮겼다. 렌더 결과 없음(사이드이펙트 전용).
 */
import { useEffect } from 'react';
import { loadKakaoSdk } from '@/lib/gung';

export function KakaoSdk(): null {
  useEffect(() => {
    void loadKakaoSdk();
  }, []);
  return null;
}
