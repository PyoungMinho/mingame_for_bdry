/**
 * 유리 균열 — 증거 카드가 유리 벽에 박힌 자리에서 방사(선 8~10개 + 가지 + 동심 조각).
 *  tone 'cyan' = 돌파(★·◆, 시안 + 흰색) · 'red' = 최종 판정 「안 통했다」 칸
 * 모션: play → .is-play → 각 선이 그려짐(stroke-dashoffset 240ms × --wt-fx-scale). 줄이기면 최종 모양으로 정지.
 * 화면 전체를 덮는 오버레이로 쓴다(viewBox 1000×1000, slice). (cx, cy) 는 오버레이 안의 % 좌표.
 */
import { C, rng, r1 } from '../palette';

export function GlassCrack({
  cx = 50,
  cy = 50,
  tone = 'cyan',
  rays = 9,
  seed = 5,
  play = false,
  className,
}: {
  cx?: number;
  cy?: number;
  tone?: 'cyan' | 'red';
  /** 8~10 */
  rays?: number;
  seed?: number;
  play?: boolean;
  className?: string;
}) {
  const rnd = rng(seed);
  const ox = cx * 10;
  const oy = cy * 10;
  const n = Math.max(8, Math.min(10, rays));
  const paths: string[] = [];
  const ringA: [number, number][] = [];
  const ringB: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
    const len = 280 + rnd() * 240;
    let x = ox;
    let y = oy;
    let d = `M${r1(x)} ${r1(y)}`;
    const segs = 4 + Math.floor(rnd() * 2);
    for (let s = 1; s <= segs; s++) {
      const rr = (len * s) / segs;
      const aa = a + (rnd() - 0.5) * 0.22;
      x = ox + Math.cos(aa) * rr;
      y = oy + Math.sin(aa) * rr;
      d += `L${r1(x)} ${r1(y)}`;
      if (s === 1) ringA.push([x, y]);
      if (s === 2) ringB.push([x, y]);
      if (s === 2 || (s === 3 && rnd() < 0.5)) {
        const ba = aa + (rnd() < 0.5 ? -1 : 1) * (0.45 + rnd() * 0.3);
        const bl = 50 + rnd() * 90;
        paths.push(`M${r1(x)} ${r1(y)}l${r1(Math.cos(ba) * bl)} ${r1(Math.sin(ba) * bl)}`);
      }
    }
    paths.unshift(d);
  }
  // 동심 조각 — 이웃 선 사이를 절반만 잇는다
  const ring = (pts: [number, number][]) => {
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      if (rnd() < 0.45) continue;
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      d += `M${r1(x1)} ${r1(y1)}L${r1((x1 + x2) / 2 + (rnd() - 0.5) * 16)} ${r1((y1 + y2) / 2 + (rnd() - 0.5) * 16)}L${r1(x2)} ${r1(y2)}`;
    }
    return d;
  };
  paths.push(ring(ringA), ring(ringB));
  const c = tone === 'red' ? C.red : C.cyan;
  const cls = ['wt-art-fx', 'wt-art-crack', play ? 'is-play' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg className={cls} viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g stroke={c} strokeWidth={9} opacity={0.35}>
          {paths.map((d, i) => d && <path key={i} d={d} pathLength={1} />)}
        </g>
        <g stroke="#FFFFFF" strokeWidth={3}>
          {paths.map((d, i) => d && <path key={i} d={d} pathLength={1} />)}
        </g>
      </g>
      <circle cx={ox} cy={oy} r={22} fill="#FFFFFF" opacity={0.9} />
      <circle cx={ox} cy={oy} r={44} fill="none" stroke={c} strokeWidth={4} opacity={0.6} />
    </svg>
  );
}
