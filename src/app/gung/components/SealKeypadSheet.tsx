/**
 * 인장 키패드 시트(개선 묶음 1 · R5, 6판 압축) — 방장이 공개한 사람에게 들은 4자리 인장을 넣어 공용 보드에 올린다.
 *
 *  - 4자리를 다 넣으면 바로 찾고, 찾으면 **그 자리에서 보드에 올린다**(6판: 「누가 밝혔소?」 확인 단계 삭제 — 약 8탭 → 5탭).
 *    '누가'는 올린 뒤 같은 시트에서 자리 칩으로 덧붙인다(안 눌러도 된다 · 누를 때마다 바로 반영 · 엔진은 자리를 덧붙이기만 한다).
 *  - 틀린 번호와 아직 들어서지 않은 라운드의 번호는 **같은 문구·같은 DOM** 으로 거절
 *    (어느 쪽인지 알려 주면 번호의 유효성을 캐내는 신탁이 된다 — 판정은 상위 lookup 이 같은 'reject' 로 돌려준다).
 *  - 잠금(3회 연속 오답 → 10초)은 상위가 쥔다(시트를 닫았다 열어도 풀리지 않게). 여기선 lockedUntil 까지 키를 막기만 한다.
 *  - 이미 오른 카드면 다시 올리지 않고 「이미 올린 단서요」 + 새 자리만 덧붙인다.
 *  - 간편 모드(장소·라운드로 카드 고르기)는 없다 — 오탭 한 번에 숨긴 카드가 전원에게 펼쳐지지 않게.
 * 프레젠테이션 전용 — 엔진 import 없음.
 */
'use client';

import { Delete } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GUIDE } from '@/lib/gung/guide-data';
import { BottomSheet } from './BottomSheet';
import { GuButton } from './GuButton';

export type SealLookup =
  | { kind: 'reject' }
  | { kind: 'locked' }
  | { kind: 'found'; id: string; head: string; duplicate: boolean; existingSeats: number[] };

export interface SealKeypadSheetProps {
  open: boolean;
  onClose: () => void;
  /** 4자리 → 결과. 오답 집계·잠금은 상위 */
  lookup: (digits: string) => SealLookup;
  /** 이 시각(ms)까지 입력 막기(0 = 안 막음) */
  lockedUntil: number;
  /** 고를 수 있는 자리(비운 자리 제외) */
  seats: number[];
  onPost: (id: string, seats: number[]) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export function SealKeypadSheet({ open, onClose, lookup, lockedUntil, seats, onPost }: SealKeypadSheetProps) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<'reject' | null>(null);
  const [found, setFound] = useState<Extract<SealLookup, { kind: 'found' }> | null>(null);
  /** 올린 뒤 덧붙인 자리(이 시트에서 누른 것) */
  const [added, setAdded] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const reset = () => {
    setDigits('');
    setError(null);
    setFound(null);
    setAdded([]);
    setNow(Date.now());
  };

  useEffect(() => {
    if (!open) return;
    setDigits('');
    setError(null);
    setFound(null);
    setAdded([]);
    setNow(Date.now());
  }, [open]);

  // 잠금이 풀리는 순간 다시 그린다
  useEffect(() => {
    if (!open || lockedUntil <= Date.now()) return;
    setNow(Date.now());
    const id = window.setTimeout(() => setNow(Date.now()), Math.max(0, lockedUntil - Date.now()) + 20);
    return () => window.clearTimeout(id);
  }, [open, lockedUntil]);

  const locked = lockedUntil > now;

  const press = (k: (typeof KEYS)[number]) => {
    if (locked || !k) return;
    setError(null);
    if (k === 'del') return setDigits((d) => d.slice(0, -1));
    const next = (digits + k).slice(0, 4);
    setDigits(next);
    if (next.length < 4) return;
    const res = lookup(next);
    setDigits('');
    if (res.kind === 'found') {
      // 6판: 찾는 즉시 올린다(이미 오른 카드는 다시 올리지 않는다)
      if (!res.duplicate) onPost(res.id, []);
      setFound(res);
      setAdded([]);
    } else if (res.kind === 'reject') {
      setError('reject');
    } else {
      setNow(Date.now());
    }
  };

  const addSeat = (s: number) => {
    if (!found || added.includes(s) || found.existingSeats.includes(s)) return;
    onPost(found.id, [s]);
    setAdded((p) => [...p, s].sort((a, b) => a - b));
  };

  return (
    <BottomSheet title={GUIDE.keypadTitle} open={open} onClose={onClose} className="gu-sealpad-sheet">
      {!found ? (
        <div className="gu-sealpad">
          <div className="gu-sealpad-slots" aria-live="polite" aria-label={`넣은 자리 ${digits.length}/4`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="gu-sealpad-slot gu-num" data-filled={i < digits.length || undefined}>
                {digits[i] ?? ''}
              </span>
            ))}
          </div>
          <p className="gu-sealpad-msg" role="status" data-tone={locked || error ? 'warn' : undefined}>
            {locked ? GUIDE.sealLocked : error === 'reject' ? GUIDE.sealReject : ' '}
          </p>
          <div className="gu-sealpad-keys">
            {KEYS.map((k, i) =>
              k === '' ? (
                <span key={i} aria-hidden />
              ) : (
                <button
                  key={i}
                  type="button"
                  className="gu-sealpad-key gu-num"
                  disabled={locked}
                  aria-label={k === 'del' ? '지우기' : k}
                  onClick={() => press(k)}
                >
                  {k === 'del' ? <Delete aria-hidden size={22} /> : k}
                </button>
              ),
            )}
          </div>
        </div>
      ) : (
        <div className="gu-sealpad-who">
          <p className="gu-sealpad-found gu-display">{found.head}</p>
          <p className={found.duplicate ? 'gu-sheet-warn' : 'gu-sealpad-posted'} role="status">
            {found.duplicate ? GUIDE.sealDuplicate : `✓ ${GUIDE.sealPosted}`}
          </p>
          <p className="gu-h3">{GUIDE.sealWho}</p>
          <div className="gu-seatchip-row" role="group" aria-label={GUIDE.sealWho}>
            {seats.map((s) => {
              const on = found.existingSeats.includes(s) || added.includes(s);
              return (
                <button key={s} type="button" className="gu-seatchip" aria-pressed={on} data-picked={on || undefined} disabled={on} onClick={() => addSeat(s)}>
                  {s}
                </button>
              );
            })}
          </div>
          <div className="gu-sheet-actions-row">
            <GuButton variant="secondary" onClick={reset}>
              {GUIDE.sealNext}
            </GuButton>
            <GuButton variant="primary" onClick={onClose}>
              {GUIDE.sealClose}
            </GuButton>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
