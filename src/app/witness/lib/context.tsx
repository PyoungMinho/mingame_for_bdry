'use client';

/**
 * 화면 공통 컨텍스트 — game 훅 + 토스트 + 수첩 시트 + 설정 시트 + 진동 + 코치마크.
 * (WitnessApp 이 값을 만들어 내려 준다. 화면·컴포넌트는 useWt() 로 읽는다)
 */
import { createContext, useContext } from 'react';
import type { HintTarget } from '@/lib/witness';
import type { WitnessGame } from './useWitnessGame';
import type { FxMode } from './fx';
import type { EndingData } from './format';

export type ToastKind = 'info' | 'cost' | 'ok' | 'warn' | 'danger' | 'star' | 'ai';

export interface ToastInput {
  kind?: ToastKind;
  text: string;
  ms?: number;
}

export type NotebookTab = 'evidence' | 'people' | 'timeline' | 'questions';

export interface WtCtx {
  game: WitnessGame;
  fx: FxMode;
  toast: (t: ToastInput) => void;
  /** 수첩 시트를 연다(허브에서는 수첩 탭으로 이동) */
  openNotebook: (tab?: NotebookTab) => void;
  closeNotebook: () => void;
  notebookOpen: boolean;
  /** 수첩 마지막 탭(허브 수첩 탭과 시트가 공유) */
  nbTab: NotebookTab;
  setNbTab: (t: NotebookTab) => void;
  /** 최종 지목 진입 게이트(★ < 3 안내 · 남은 시간 확인 · 강제 지목) */
  requestAccuse: () => void;
  /** 수첩에서 줄로 이동(타임라인 주장 항목) */
  jumpToLine: (lineId: string) => void;
  openSettings: () => void;
  openRules: () => void;
  openCollection: () => void;
  openCaseFile: () => void;
  openShare: (d: EndingData) => void;
  /** 설정(진동 켬)을 따르는 진동 */
  vib: (pattern: number | readonly number[]) => void;
  /** 수첩 정리(힌트) 대상으로 이동 */
  gotoTarget: (t: HintTarget) => void;
  /** 코치마크를 이미 봤는지 */
  coachSeen: (id: string) => boolean;
}

export const WtContext = createContext<WtCtx | null>(null);

export function useWt(): WtCtx {
  const v = useContext(WtContext);
  if (!v) throw new Error('WtContext 밖에서 사용할 수 없습니다.');
  return v;
}
