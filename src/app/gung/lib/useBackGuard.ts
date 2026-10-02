'use client';

/**
 * §12-4 백 가드 — 인게임 진입 시 history 센티널 1개를 심어 두고, 안드로이드 하드웨어 뒤로가기를
 * "시트 닫기" 또는 "무해한 토스트"로 바꾼다. 셋업 화면에서는 적용하지 않는다(상위가 enabled로 결정).
 */
import { useEffect, useRef } from 'react';

export function useBackGuard(enabled: boolean, onBack: () => boolean | void): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    window.history.pushState({ gu: 1 }, '');
    const onPop = () => {
      onBackRef.current();
      // 시트를 닫았든 안 닫았든, 게임 이탈을 막기 위해 센티널을 다시 심는다.
      window.history.pushState({ gu: 1 }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [enabled]);
}

/**
 * §12-4 셋업 화면(S2~S6·O9·코드 오류) 백 가드 — 하드웨어 뒤로 = 이전 셋업 단계(QA BUG-21).
 * stepKey 가 null(홈·인게임)이면 가드하지 않는다. 가드할 단계에 들어설 때 센티널이 없으면 1개 심고, 뒤로가 그 센티널을 소비하면
 * onBack(이전 단계로)을 부른다. 이전 단계도 가드 대상이면 단계 키가 바뀌며 센티널을 다시 심는다.
 * 인게임 가드(useBackGuard)와 동시에 듣더라도 인게임에선 stepKey 가 null 이라 아무것도 하지 않는다.
 */
export function useSetupBackGuard(stepKey: string | null, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const keyRef = useRef(stepKey);
  keyRef.current = stepKey;
  const armed = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      if (!armed.current) return;
      armed.current = false;
      if (keyRef.current !== null) onBackRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (stepKey === null || armed.current || typeof window === 'undefined') return;
    window.history.pushState({ gu: 'setup' }, '');
    armed.current = true;
  }, [stepKey]);
}
