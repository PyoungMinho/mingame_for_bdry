/**
 * §5-7 SealedCard — 핵심 프라이버시 컴포넌트(§10-1 동작 규약).
 *
 * 이 컴포넌트는 "열림 여부"를 소유하지 않는다(props 만). 400ms 홀드 임계값·pointer capture·
 * visibilitychange 즉시 봉인 같은 **타이밍/이벤트 로직은 상위 훅(`lib/useHoldReveal.ts`, 페이지개발자)**이
 * 담당하고, 여기서는 `open` 불리언과 `pressBind`(그대로 꽂는 이벤트 핸들러 묶음)만 받는다.
 * 보안 요구사항(D4: "봉인 상태에서는 비밀 텍스트를 DOM에 렌더하지 않는다")은 이 컴포넌트가 직접 보장한다 —
 * `open=false`면 `renderContent()`를 호출조차 하지 않는다(조건부 렌더).
 */
import { Hand } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PressBind, SealMode } from './types';

export interface SealedCardPages {
  index: number;
  count: number;
  onChange: (index: number) => void;
}

export interface SealedCardProps {
  /** 열림 여부 — 상위가 제어 */
  open: boolean;
  seatLabel: string;
  mode: SealMode;
  renderContent: () => ReactNode;
  /** 열린 상태 우상단 워터마크(예: "3번 · 22:41") — 캡처 유포 억제(§10-1) */
  watermark?: string;
  pages?: SealedCardPages;
  pressBind?: PressBind;
  /** 누르는 동안 낙관 둘레 금빛 링 진행도 0..1(§4-4) */
  holdProgress?: number;
  /** 탭 모드 15초 자동 봉인 — 남은 시간 표시용(ms) */
  tapRemainingMs?: number;
  tapTotalMs?: number;
  ariaLabel?: string;
  /** 스크린리더 보조 설명(§11): "주변에 아무도 없을 때 이어폰으로 확인하세요" 등 */
  srHint?: string;
  className?: string;
}

export function SealedCard({
  open,
  seatLabel,
  mode,
  renderContent,
  watermark,
  pages,
  pressBind,
  holdProgress = 0,
  tapRemainingMs,
  tapTotalMs,
  ariaLabel,
  srHint,
  className,
}: SealedCardProps) {
  const describedId = srHint ? `${seatLabel.replace(/\s+/g, '-')}-gu-hint` : undefined;
  const tapPct = tapTotalMs && tapRemainingMs !== undefined ? Math.max(0, Math.min(1, tapRemainingMs / tapTotalMs)) : undefined;

  return (
    <div className={['gu-sealed', className ?? ''].filter(Boolean).join(' ')} data-open={open || undefined}>
      <div
        {...pressBind}
        role="button"
        tabIndex={0}
        aria-pressed={open}
        aria-label={ariaLabel ?? `${seatLabel} — 비밀 정보. ${mode === 'hold' ? '길게 누르는 동안 표시' : '탭하면 잠시 표시'}`}
        aria-describedby={describedId}
        className="gu-sealed-surface"
        onContextMenu={(e) => {
          e.preventDefault();
          pressBind?.onContextMenu?.(e);
        }}
      >
        {!open ? (
          <div className="gu-sealed-closed">
            <span className="gu-sealed-mark" style={{ ['--gu-hold-progress' as string]: holdProgress }} aria-hidden>
              봉
            </span>
            <p className="gu-sealed-hint">
              <Hand aria-hidden size={18} />
              {mode === 'hold' ? '꾹 누르고 있으면 보여요' : '탭하면 보여요'}
            </p>
            <p className="gu-sealed-sub">{seatLabel}</p>
          </div>
        ) : (
          <div className="gu-sealed-open">
            {watermark && (
              <span className="gu-sealed-watermark" aria-hidden>
                {watermark}
              </span>
            )}
            <div className="gu-sealed-paper">{renderContent()}</div>
            <p className="gu-sealed-release">{mode === 'hold' ? '✋ 손을 떼면 바로 가려져요' : tapPct !== undefined ? `탭으로 열림 · 남음 ${Math.ceil((tapRemainingMs ?? 0) / 1000)}초` : '다시 탭하면 가려져요'}</p>
            {tapPct !== undefined && (
              <span className="gu-sealed-tapbar" aria-hidden>
                <span className="gu-sealed-tapbar-fill" style={{ width: `${tapPct * 100}%` }} />
              </span>
            )}
          </div>
        )}
      </div>
      {srHint && (
        <span id={describedId} className="gu-sr">
          {srHint}
        </span>
      )}
      {/*
        D3(QA BUG-01): 봉인 상태의 쪽 칩은 **내용과 무관하게 늘 같은 모양**이어야 한다. 예전엔 봉인면에 'n/N'을 그려서
        범인만 '거짓말 1/3'(추천 변명 몫)이 떠 어깨 너머로 범인이 드러났다. 그래서 봉인 중엔 쪽 수·현재 쪽을 그리지 않고
        고정 라벨만 둔다. 몇 쪽인지는 연 동안에만(손으로 가린 채) 보인다.
      */}
      {pages && (
        <div className="gu-sealed-pager" aria-hidden={open || undefined}>
          {open ? (
            <span className="gu-sealed-pager-label">
              {pages.index + 1}/{pages.count}
            </span>
          ) : (
            <button
              type="button"
              className="gu-sealed-pager-btn"
              onClick={() => pages.onChange((pages.index + 1) % Math.max(1, pages.count))}
              aria-label="다음 쪽 — 몇 쪽인지는 열었을 때 보이오"
            >
              다음 쪽 ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
