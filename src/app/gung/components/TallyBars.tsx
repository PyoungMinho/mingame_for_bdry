/**
 * §5-18 TallyBars — 행 48h: "3번 상궁" + 막대(cta, 최대 대비 비율) + 수. 범인 여부 표시 금지.
 */
export interface TallyRow {
  seat: number;
  roleName?: string;
  count: number;
}

export interface TallyBarsProps {
  rows: TallyRow[];
  tiedSeats?: number[];
  className?: string;
}

export function TallyBars({ rows, tiedSeats = [], className }: TallyBarsProps) {
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((r) => r.count));
  const topCount = sorted[0]?.count ?? 0;

  return (
    <div className={['gu-tally', className ?? ''].filter(Boolean).join(' ')} role="table" aria-label="지목 집계">
      {sorted.map((r) => {
        const isTop = r.count === topCount && topCount > 0;
        const isTied = tiedSeats.includes(r.seat);
        return (
          <div key={r.seat} className="gu-tally-row" data-top={isTop || undefined} role="row">
            <span className="gu-tally-label">
              {r.seat}번{r.roleName ? ` ${r.roleName}` : ''}
            </span>
            <span className="gu-tally-bar-track" aria-hidden>
              <span className="gu-tally-bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="gu-tally-count gu-num">{r.count}</span>
            {isTied && <span className="gu-tally-tied">동률</span>}
          </div>
        );
      })}
    </div>
  );
}
