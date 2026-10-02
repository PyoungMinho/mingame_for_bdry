/**
 * 「R2부터」「R3부터」 라운드 잠금 표기(원고 3판)를 배지로 그리는 텍스트 렌더러.
 * 글자는 한 자도 바꾸지 않는다 — 배지 안 글자도 원문 그대로이고, 배지가 붙은 대목은 줄을 바꿔 읽기 쉽게만 한다
 * (textContent 를 이어 붙이면 원문과 같다). 프레젠테이션 전용 — 엔진 import 없음.
 */
import { Fragment } from 'react';

const TAG_SRC = 'R([1-3])부터';

export interface RoundTagPart {
  /** 배지가 붙은 대목이면 그 라운드 번호, 앞머리(배지 없음)면 null */
  round: number | null;
  tag?: string;
  text: string;
}

/** 'A. R2부터 B. R3부터 C.' → [{round:null,text:'A. '}, {round:2,tag:'R2부터',text:' B. '}, {round:3,tag:'R3부터',text:' C.'}] */
export function splitRoundTags(text: string): RoundTagPart[] {
  const out: RoundTagPart[] = [];
  let last = 0;
  let cur: RoundTagPart = { round: null, text: '' };
  const re = new RegExp(TAG_SRC, 'g'); // 호출마다 새로 — lastIndex 공유 금지
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const at = m.index;
    cur.text += text.slice(last, at);
    if (cur.round !== null || cur.text) out.push(cur);
    cur = { round: Number(m[1]), tag: m[0], text: '' };
    last = at + m[0].length;
  }
  cur.text += text.slice(last);
  if (cur.round !== null || cur.text) out.push(cur);
  return out;
}

export interface RoundTagTextProps {
  text: string;
  /** 지금 이 폰의 조사 라운드(0 = 조사 전). 배지 라운드 ≤ current 면 '지금 유효' 표시 */
  current?: number;
}

export function RoundTagText({ text, current = 0 }: RoundTagTextProps) {
  const parts = splitRoundTags(text);
  if (parts.every((p) => p.round === null)) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.round === null ? (
          <Fragment key={i}>{p.text}</Fragment>
        ) : (
          <span key={i} className="gu-rtag-seg">
            <span
              className="gu-rtag"
              data-state={current >= p.round ? 'open' : 'locked'}
              title={current >= p.round ? `${p.round}라운드부터 · 지금 적용` : `${p.round}라운드부터 · 그 전엔 침묵만(부인·지어내기 금지)`}
            >
              {p.tag}
            </span>
            {p.text}
          </span>
        ),
      )}
    </>
  );
}
