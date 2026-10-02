/**
 * 개인 추리 수첩(개선 묶음 1 · R4) — 4번째 탭. 프레젠테이션 전용(저장·60초 복귀는 상위 GungApp/useGungNotes).
 *
 *  - 행 = 이 판의 착석 자리 중 내 자리를 뺀 모두(NPC 행 없음). 열 = 수단·기회·동기.
 *  - 칸을 탭할 때마다 빈칸 → ○ → ✕ → 빈칸. 칸당 터치 48px 이상. **앱은 어떤 칸도 미리 채우거나 바꾸지 않는다.**
 *  - 합계·순위·'의심 1위' 같은 계산 표시 없음. 보너스 문항 관련 칸·보기 없음.
 *  - 봉인(꾹 누르기)은 쓰지 않는다 — 표를 탭해야 하므로 꾹 누르기와 겹치면 안 된다(직전 PM '다음 쪽' 불만). 노출 방지는
 *    60초 무입력 → 진행 탭 복귀(상위)로 한다. 그래서 입력·탭마다 onActivity 를 부른다.
 *  - 행·열·문구 구조가 모든 역할에 같다(범인 수첩도 같은 모양).
 */
'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';
import { GUIDE } from '@/lib/gung/guide-data';
import { RoleIcon } from './icons';
import type { RoleIconKey } from './types';

export type NoteColKey = 'means' | 'opp' | 'motive';
export type NoteMarkValue = 'o' | 'x';
const COLS: readonly NoteColKey[] = ['means', 'opp', 'motive'];

export interface NotebookRow {
  seat: number;
  /** '3번' 또는 '3번 · 어의'(자기소개 뒤) */
  label: string;
  icon?: RoleIconKey;
}

export interface NotebookTabProps {
  rows: NotebookRow[];
  marks: Record<number, Partial<Record<NoteColKey, NoteMarkValue>>>;
  lines: Record<number, string>;
  free: string;
  lineMax: number;
  freeMax: number;
  onCycle: (seat: number, col: NoteColKey) => void;
  onLine: (seat: number, text: string) => void;
  onFree: (text: string) => void;
  onClear: () => void;
  /** 탭·입력이 있을 때마다 — 상위의 60초 무입력 복귀 타이머를 다시 건다 */
  onActivity: () => void;
  className?: string;
}

const MARK_GLYPH: Record<NoteMarkValue, string> = { o: '○', x: '✕' };
const MARK_WORD: Record<NoteMarkValue, string> = { o: '그럴 수 있었소', x: '아니라는 물증' };

export function NotebookTab({ rows, marks, lines, free, lineMax, freeMax, onCycle, onLine, onFree, onClear, onActivity, className }: NotebookTabProps) {
  const [help, setHelp] = useState(false);
  return (
    <div
      className={['gu-notes', className ?? ''].filter(Boolean).join(' ')}
      onPointerDownCapture={onActivity}
      onKeyDownCapture={onActivity}
      onInputCapture={onActivity}
      onFocusCapture={onActivity}
    >
      <p className="gu-notes-head">{GUIDE.notesHead}</p>
      <p className="gu-notes-legend">{GUIDE.notesLegend}</p>
      <div className="gu-notes-table" role="table" aria-label="용의자 표">
        <div className="gu-notes-row gu-notes-row--head" role="row">
          <span className="gu-notes-who" role="columnheader">
            <button type="button" className="gu-notes-help" aria-expanded={help} aria-label="열 도움말" onClick={() => setHelp((h) => !h)}>
              <Info aria-hidden size={18} />
            </button>
          </span>
          {COLS.map((col) => (
            <span key={col} className="gu-notes-colhead" role="columnheader">
              {GUIDE.notesCols[col]}
            </span>
          ))}
        </div>
        {help && (
          <ul className="gu-notes-helpbox">
            {COLS.map((col) => (
              <li key={col}>{GUIDE.notesColHelp[col]}</li>
            ))}
          </ul>
        )}
        {rows.map((row) => (
          <div key={row.seat} className="gu-notes-rowwrap">
            <div className="gu-notes-row" role="row" data-seat={row.seat}>
              <span className="gu-notes-who" role="rowheader">
                {row.icon && <RoleIcon iconKey={row.icon} size={16} />}
                <span className="gu-notes-who-label">{row.label}</span>
              </span>
              {COLS.map((col) => {
                const m = marks[row.seat]?.[col];
                return (
                  <span key={col} role="cell" className="gu-notes-cellwrap">
                    <button
                      type="button"
                      className="gu-notes-cell"
                      data-seat={row.seat}
                      data-col={col}
                      data-mark={m ?? ''}
                      aria-label={`${row.label} ${GUIDE.notesCols[col]}: ${m ? MARK_WORD[m] : '빈칸'}`}
                      onClick={() => onCycle(row.seat, col)}
                    >
                      {m ? MARK_GLYPH[m] : ''}
                    </button>
                  </span>
                );
              })}
            </div>
            <input
              type="text"
              className="gu-notes-line"
              aria-label={`${row.label} ${GUIDE.notesLinePlaceholder}`}
              placeholder={GUIDE.notesLinePlaceholder}
              maxLength={lineMax}
              value={lines[row.seat] ?? ''}
              onChange={(e) => onLine(row.seat, e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
            />
          </div>
        ))}
      </div>
      <textarea
        className="gu-notes-free"
        aria-label={GUIDE.notesFreePlaceholder}
        placeholder={GUIDE.notesFreePlaceholder}
        maxLength={freeMax}
        rows={4}
        value={free}
        onChange={(e) => onFree(e.target.value)}
      />
      <p className="gu-micro">{GUIDE.notesIdle}</p>
      <button type="button" className="gu-ghostlink gu-text-danger" onClick={onClear}>
        {GUIDE.notesClear}
      </button>
    </div>
  );
}
