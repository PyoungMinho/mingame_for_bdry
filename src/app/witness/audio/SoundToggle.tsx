'use client';

/**
 * 스피커 토글(44px) — 타이틀(설정 톱니 옆) · 인트로 컷 · 규칙 카드 · 허브 HUD(… 메뉴 옆). 조사/증언 화면은 HUD 가 좁아(한결 얼굴을 지킨다)
 * 허브로 나가거나 설정의 「소리」로 끈다.
 * 누르면 즉시 반영(엔진이 50ms 램프)되고 meta.settings.muted 에 저장된다. 음소거를 푸는 탭은 그 자체가 제스처라 바로 소리를 연다.
 * 접근성(WAI-ARIA 토글 버튼): 이름은 '소리 끄기'로 고정하고 상태는 aria-pressed 로만 알린다(음소거 = 눌림). 아이콘만 상태에 따라 바뀐다.
 */
import { Volume2, VolumeX } from 'lucide-react';
import { useContext } from 'react';
import { WtContext } from '../lib/context';
import { unlockAudio } from './useGameAudio';

export function SoundToggle({ className }: { className?: string }) {
  // 컨텍스트 밖(HUD 단독 렌더 등)에서는 그리지 않는다
  const wt = useContext(WtContext);
  if (!wt) return null;
  const { game } = wt;
  const muted = game.settings.muted;
  return (
    <button
      type="button"
      className={['wt-iconbtn', 'wt-soundbtn', className].filter(Boolean).join(' ')}
      aria-label="소리 끄기"
      aria-pressed={muted}
      data-testid="sound-toggle"
      onClick={() => {
        const next = !muted;
        game.updateSettings({ muted: next });
        if (!next) unlockAudio(true);
      }}
    >
      {muted ? <VolumeX size={20} aria-hidden /> : <Volume2 size={20} aria-hidden />}
    </button>
  );
}
