"use client";

import { useEffect } from "react";

/**
 * 로드 모션 트리거 — 페이지가 "실제로 보일 때"만 <html>.mf-anim-ready를 붙여 1회 재생.
 *
 * 기본(클래스 없음) 상태는 globals.css에서 이미 "완성·노출" 상태로 정의돼 있어,
 * JS 미실행·구형 브라우저·백그라운드 탭(visibility hidden, 애니메이션 일시정지)에서도
 * 콘텐츠는 항상 보인다. 애니메이션은 어디까지나 가산적 연출이며 가시성을 좌우하지 않는다.
 */
export default function LoadReveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains("mf-anim-ready")) return;

    let raf = 0;
    const play = () => {
      // 더블 rAF — 첫 페인트 이후 클래스를 붙여 from→to 전이가 깔끔히 재생되게.
      raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => root.classList.add("mf-anim-ready"))
      );
    };

    if (document.visibilityState === "visible") {
      play();
      return () => cancelAnimationFrame(raf);
    }

    // 백그라운드 탭에서 열렸으면 보이게 될 때까지 대기(그동안 기본 노출 상태 유지).
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", onVisible);
        play();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
