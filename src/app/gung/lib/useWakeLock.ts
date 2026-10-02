'use client';

/**
 * §12-5 화면 꺼짐 방지 — navigator.wakeLock 우선, 미지원 + 방장일 때만 숨은 <video> 루프(NoSleep 방식)로
 * 폴백한다. 둘 다 실패하면 'off'(헤더 🌙, S3/H1 Banner 로 안내는 화면 레이어가 처리).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type WakeStatus = 'on' | 'off' | 'na';

interface WakeSentinel {
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
}
interface WakeLockApi {
  request: (type: 'screen') => Promise<WakeSentinel>;
}

function hasWakeLockApi(): boolean {
  return typeof navigator !== 'undefined' && Boolean((navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock);
}

/** play() 는 구형 브라우저에서 undefined 를, jsdom 에선 throw 를 한다 — 항상 Promise 로 */
function playVideo(v: HTMLVideoElement): Promise<void> {
  try {
    return Promise.resolve(v.play());
  } catch (e) {
    return Promise.reject(e);
  }
}

/**
 * videoRef 는 **콜백 ref** — 폴백 <video> 는 화면에 따라 다른 엘리먼트가 된다(S3 초대 화면 ↔ 본 화면).
 * QA BUG-10: 예전엔 effect 가 처음 붙은 비디오 하나만 재생해서, 초대 → 대기실로 넘어가며 새 <video> 가 붙으면
 * 재생이 끊긴 채 상태는 'on'(🕯)으로 남았다. 이제 엘리먼트가 바뀔 때마다 새 것을 재생하고 결과로 상태를 갱신한다.
 */
export function useWakeLock(active: boolean, isHost: boolean): { status: WakeStatus; videoRef: (el: HTMLVideoElement | null) => void } {
  const [status, setStatus] = useState<WakeStatus>('na');
  const sentinelRef = useRef<WakeSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const setVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    setVideoEl(el);
  }, []);

  useEffect(() => {
    if (!active) {
      sentinelRef.current?.release().catch(() => undefined);
      sentinelRef.current = null;
      try {
        videoRef.current?.pause();
      } catch {
        /* 일부 환경(테스트 jsdom 등) 미지원 */
      }
      setStatus('na');
      return;
    }

    let cancelled = false;
    const wakeLock = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;

    const acquire = async () => {
      if (!wakeLock) {
        if (isHost) {
          const v = videoRef.current;
          if (!v) return; // 아직 비디오가 없다 — 붙는 순간 아래 effect 가 재생한다
          try {
            await playVideo(v);
            if (!cancelled) setStatus('on');
          } catch {
            if (!cancelled) setStatus('off');
          }
        } else if (!cancelled) {
          setStatus('na');
        }
        return;
      }
      try {
        const s = await wakeLock.request('screen');
        if (cancelled) {
          s.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = s;
        setStatus('on');
        s.addEventListener('release', () => {
          if (!cancelled) setStatus('off');
        });
      } catch {
        if (!cancelled) setStatus('off');
      }
    };
    void acquire();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinelRef.current?.release().catch(() => undefined);
      sentinelRef.current = null;
    };
  }, [active, isHost]);

  // 폴백 비디오 엘리먼트가 바뀌면(초대 화면 → 본 화면) 새 엘리먼트를 재생한다
  useEffect(() => {
    if (!active || !isHost || !videoEl || hasWakeLockApi()) return;
    let cancelled = false;
    playVideo(videoEl).then(
      () => {
        if (!cancelled) setStatus('on');
      },
      () => {
        if (!cancelled) setStatus('off');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [videoEl, active, isHost]);

  return { status, videoRef: setVideo };
}
