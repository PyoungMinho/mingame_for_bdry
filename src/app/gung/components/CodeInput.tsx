'use client';

/**
 * §5-24 CodeInput — 5칸(4+1) 56×64, mono 32. 자동 대문자·자동 다음칸·붙여넣기 지원.
 * 문자 집합은 §7-1 고정 프로토콜(시드 4자 + 인원 1자) — 게임 데이터가 아니라 코드 포맷 자체라 여기 하드코딩한다.
 */
import { useRef, useState } from 'react';

const SEED_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 0 O 1 I L 제외
const COUNT_CHARS = '456';

export interface CodeInputProps {
  onComplete: (code: string) => void;
  onChange?: (partial: string) => void;
  invalid?: boolean;
  className?: string;
  /**
   * 붙여넣은 글 전체에서 완성된 코드 5자를 뽑는 함수(화면 레이어가 엔진 extractRoomCode 를 꽂는다).
   * 코드를 돌려주면 그 코드로 5칸을 채운다.
   */
  parsePaste?: (text: string) => string | null;
}

/** 링크처럼 보이는 글 — 'https'·'gung' 글자를 코드 칸에 흘려 넣지 않는다(QA BUG-11: HTTP-5 자동 입장) */
const LINK_LIKE = /[a-z]+:\/\/|www\.|\/gung|code=/i;

export function CodeInput({ onComplete, onChange, invalid, className, parsePaste }: CodeInputProps) {
  const [chars, setChars] = useState<string[]>(['', '', '', '', '']);
  const [linkError, setLinkError] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const allowedAt = (i: number) => (i < 4 ? SEED_CHARS : COUNT_CHARS);

  const setAt = (i: number, value: string, nextFocus: boolean) => {
    setLinkError(false);
    const next = [...chars];
    next[i] = value;
    setChars(next);
    onChange?.(next.join(''));
    if (next.every((c) => c !== '')) onComplete(next.join(''));
    if (nextFocus && value && i < 4) refs.current[i + 1]?.focus();
  };

  const handleInput = (i: number, raw: string) => {
    const ch = raw.toUpperCase().slice(-1);
    if (!ch) {
      setAt(i, '', false);
      return;
    }
    if (!allowedAt(i).includes(ch)) return;
    setAt(i, ch, true);
  };

  const handlePaste = (i: number, text: string) => {
    const whole = parsePaste?.(text);
    if (whole && whole.length === 5) {
      const next = whole.split('');
      setChars(next);
      onChange?.(whole);
      onComplete(whole);
      refs.current[4]?.focus();
      return;
    }
    if (LINK_LIKE.test(text)) {
      // 코드가 없는(또는 틀린) 링크 — 아무 칸도 채우지 않고 오류만 보인다
      onChange?.(chars.join(''));
      setLinkError(true);
      return;
    }
    const cleaned = text.toUpperCase().replace(/[\s-]/g, '');
    if (!cleaned) return;
    const next = [...chars];
    let cursor = i;
    for (const raw of cleaned) {
      if (cursor > 4) break;
      if (!allowedAt(cursor).includes(raw)) continue;
      next[cursor] = raw;
      cursor += 1;
    }
    setChars(next);
    onChange?.(next.join(''));
    if (next.every((c) => c !== '')) onComplete(next.join(''));
    refs.current[Math.min(cursor, 4)]?.focus();
  };

  return (
    <div className={['gu-codeinput', className ?? ''].filter(Boolean).join(' ')} data-invalid={invalid || linkError || undefined}>
      <div className="gu-codeinput-row">
        {chars.map((c, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="gu-codeinput-cell"
            value={c}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={1}
            aria-label={i < 4 ? `코드 ${i + 1}번째 글자` : '인원 수'}
            onChange={(e) => handleInput(i, e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              handlePaste(i, e.clipboardData.getData('text'));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !chars[i] && i > 0) {
                refs.current[i - 1]?.focus();
              }
            }}
          />
        ))}
      </div>
      {invalid && <p className="gu-codeinput-error">⚠ 코드가 맞지 않소 — 0·O·1·I·L은 쓰지 않아요</p>}
      {!invalid && linkError && <p className="gu-codeinput-error">⚠ 붙여 넣은 링크에 방 코드가 없소 — 초대 링크를 그대로 누르거나 코드 5자를 넣으시오</p>}
    </div>
  );
}
