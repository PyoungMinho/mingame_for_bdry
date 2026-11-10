import type { ReactNode } from 'react';
import { cx } from '../sheet/cx';

export type ResultDocKind = 'reprimand' | 'award' | 'joint';

export interface DocRow {
  label: string;
  value: ReactNode;
  /** 경위·품의 내용: 4줄 높이(84px) 고정 */
  tall?: boolean;
  /** 서명란: 오른쪽 정렬 `(인)` */
  sign?: boolean;
}

export interface ResultDocProps {
  kind: ResultDocKind;
  /** 제목 — 문구에는 띄어쓰기를 넣지 않는다(자간으로 벌린다). 5자 이상이면 자간 0.2em */
  title: string;
  rows: readonly DocRow[];
  /** 오른쪽 위 결재란. 시말서 = 도장 1개(맨 오른쪽), 품의서 = 3개 모두, 경위서 = 없음(null) */
  approval?: { labels: readonly [string, string, string]; stamps: readonly [string, string, string] } | null;
  /** ※ 경보 실패한 사람에게만 붙는 한 줄 */
  alarmFailLine?: string;
  /** 꼬리 11px: `게임 결과 연출 · 베타` + 무관 고지 — 결과 문서 꼬리에만 둔다 */
  footnote: string;
}

/** 결과 문서(시말서·포상 품의서·공동 경위서). 격자선이 꺼진 시트 위에 그린 양식이다. 선은 검은 1px 실선. */
export function ResultDoc({ kind, title, rows, approval, alarmFailLine, footnote }: ResultDocProps) {
  const long = Array.from(title).length >= 5;
  return (
    <article className="mc-doc" data-kind={long ? 'long' : undefined} data-doc={kind} aria-label={title}>
      <h2 className="mc-doc__title">{title}</h2>
      {approval ? <ApprovalBox labels={approval.labels} stamps={approval.stamps} /> : null}
      <div className="mc-doc__table">
        {rows.map((r, i) => (
          <div key={i} className="mc-doc__row">
            <div className="mc-doc__label">{r.label}</div>
            <div className={cx('mc-doc__value', r.sign && 'mc-doc__sign')} data-tall={r.tall ? 'true' : undefined}>
              {r.value}
            </div>
          </div>
        ))}
      </div>
      {alarmFailLine ? <div className="mc-doc__note">{alarmFailLine}</div> : null}
      <div className="mc-doc__foot">{footnote}</div>
    </article>
  );
}

/** 결재란 3칸 × 2행. stamps[i] 가 빈 문자열이면 도장 없음. */
export function ApprovalBox({ labels, stamps }: { labels: readonly [string, string, string]; stamps: readonly [string, string, string] }) {
  return (
    <div className="mc-doc__approval" role="group" aria-label={labels.join(' ')}>
      {labels.map((l, i) => (
        <div key={`l${i}`} className="mc-doc__approval-label">
          {l}
        </div>
      ))}
      {stamps.map((s, i) => (
        <div key={`s${i}`} className="mc-doc__approval-box">
          {s ? <Stamp text={s} /> : null}
        </div>
      ))}
    </div>
  );
}

/** 지름 36px 도장. 각도 -6° 고정(움직임 아님). 글자 11px. */
export function Stamp({ text }: { text: string }) {
  return <span className="mc-stamp">{text}</span>;
}
