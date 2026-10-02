/**
 * 용어 풀이(원고 1-6)·시각표(원고 1-5) — 프레젠테이션 전용.
 *  - TermList: 용어 「?」 시트(기본 용어 + 열린 공용 카드 용어)와 단서 카드 안(그 카드를 열었을 때만)에서 같은 모양으로 쓴다.
 *  - TimeTable: 시진 → 지금 시각. 방장 브리핑 화면·용어 시트 맨 위.
 */
import type { TermItem, WatchRowView } from './types';

export interface TermListProps {
  terms: TermItem[];
  /** 'card' = 단서 카드 안 작은 각주 */
  variant?: 'sheet' | 'card';
  className?: string;
}

export function TermList({ terms, variant = 'sheet', className }: TermListProps) {
  if (!terms.length) return null;
  return (
    <dl className={['gu-terms', className ?? ''].filter(Boolean).join(' ')} data-variant={variant}>
      {terms.map((t) => (
        <div key={t.term} className="gu-terms-row">
          <dt className="gu-terms-term">{variant === 'card' ? `? ${t.term}` : t.term}</dt>
          <dd className="gu-terms-desc">{t.desc}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface TimeTableProps {
  rows: WatchRowView[];
  note?: string;
  title?: string;
  className?: string;
}

export function TimeTable({ rows, note, title = '시각표', className }: TimeTableProps) {
  if (!rows.length) return null;
  return (
    <section className={['gu-timetable', className ?? ''].filter(Boolean).join(' ')} aria-label={title}>
      <p className="gu-timetable-title">{title}</p>
      <table className="gu-timetable-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">
                {r.name} <span className="gu-timetable-hanja">{r.hanja}</span>
              </th>
              <td className="gu-num">{r.span}</td>
              <td className="gu-timetable-parts">{r.parts ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="gu-micro">{note}</p>}
    </section>
  );
}
