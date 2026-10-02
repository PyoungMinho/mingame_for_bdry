/**
 * 방장 폰 상단 「내문 출입 타임라인」 막대 (원고 1-8 앱 구현 메모, 3판).
 * 술시~축시 × 초·정·말 눈금 위에 **이미 펼친 공용 카드의 출입 기록만** 사람(레인)별로 찍는다.
 *  - 入 = 채운 원, 出 = 빈 원(색만으로 구분하지 않는다 — 글자 자체가 入/出).
 *  - 같은 사람의 入→出 이 둘 다 기록에 있을 때만 막대로 잇는다(기록 밖 체류는 그리지 않는다).
 *  - 같은 눈금 안 순서는 x 위치(적힌 순서대로 왼→오)로 보인다. 같은 사람·같은 눈금의 여러 기록은 한 알약으로 묶는다.
 * 프레젠테이션 전용 — 엔진 import 없음. 화면 낭독기용으로 같은 내용을 목록(gu-sr)으로도 내린다.
 */

export interface GateTimelineView {
  title: string;
  watches: string[];
  parts: string[];
  lanes: { key: string; label: string }[];
  /** x = 눈금 단위(0 = 첫 시진 초의 왼끝, ticks = 오른끝) */
  marks: { key: string; lane: string; x: number; glyph: string; dir: 'in' | 'out' | 'both'; label: string }[];
  spans: { key: string; lane: string; from: number; to: number }[];
  /** 기록 순서대로 읽는 문장(접근성·확인용) */
  readout: string[];
}

export interface GateTimelineBarProps {
  data: GateTimelineView;
  className?: string;
}

const pct = (x: number, total: number) => `${((x / total) * 100).toFixed(3)}%`;

export function GateTimelineBar({ data, className }: GateTimelineBarProps) {
  const P = data.parts.length;
  const T = data.watches.length * P;
  return (
    <details className={['gu-gatetl', className ?? ''].filter(Boolean).join(' ')} open>
      <summary className="gu-gatetl-head">
        <span className="gu-gatetl-title">{data.title} 타임라인</span>
        <span className="gu-gatetl-legend" aria-hidden>
          <span className="gu-gatetl-dot" data-dir="in">
            入
          </span>
          들어옴
          <span className="gu-gatetl-dot" data-dir="out">
            出
          </span>
          나감
        </span>
      </summary>
      <div className="gu-gatetl-grid" aria-hidden>
        {data.lanes.map((lane) => (
          <div key={lane.key} className="gu-gatetl-row">
            <span className="gu-gatetl-lane">{lane.label}</span>
            <div className="gu-gatetl-track">
              {data.watches.map((w, i) => (
                <span key={w} className="gu-gatetl-band" data-alt={i % 2 === 1 || undefined} style={{ left: pct(i * P, T), width: pct(P, T) }} />
              ))}
              {data.spans
                .filter((s) => s.lane === lane.key)
                .map((s) => (
                  <span key={s.key} className="gu-gatetl-span" style={{ left: pct(s.from, T), width: pct(Math.max(0.001, s.to - s.from), T) }} />
                ))}
              {data.marks
                .filter((m) => m.lane === lane.key)
                .map((m) => (
                  <span key={m.key} className="gu-gatetl-dot gu-gatetl-mark" data-dir={m.dir} style={{ left: pct(m.x, T) }} title={m.label}>
                    {m.glyph}
                  </span>
                ))}
            </div>
          </div>
        ))}
        <div className="gu-gatetl-row gu-gatetl-axisrow">
          <span className="gu-gatetl-lane" />
          <div className="gu-gatetl-track gu-gatetl-axis">
            {Array.from({ length: T }, (_, t) => (
              <span key={t} className="gu-gatetl-tick" data-major={t % P === 0 || undefined} style={{ left: pct(t + 0.5, T) }}>
                {data.parts[t % P]}
              </span>
            ))}
            {data.watches.map((w, i) => (
              <span key={w} className="gu-gatetl-watch" style={{ left: pct(i * P + P / 2, T) }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ol className="gu-sr" aria-label={`${data.title} 기록`}>
        {data.readout.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </details>
  );
}
