/**
 * 대체 그림 — 키가 없거나 그림을 지연 로드하는 동안. 같은 3:2 틀에 밤 창 + 바닥만.
 * (P0 개발용 대체 아트 규칙: 최종본과 같은 props)
 */
import { C } from '../palette';
import { SceneSvg } from './parts';
import type { SceneArtProps } from './types';

export function SceneFallbackArt({ className, fit }: SceneArtProps) {
  return (
    <SceneSvg art="fallback" className={className} fit={fit}>
      <rect width={1500} height={1000} fill={C.wall0} />
      <rect x={330} y={60} width={840} height={460} rx={6} fill={C.night1} />
      <path d="M330 420h840" stroke={C.night3} strokeWidth={3} />
      <path d="M0 640H1500V1000H0Z" fill={C.walnut1} />
      <rect x={330} y={40} width={840} height={6} rx={3} fill={C.cyan} opacity={0.35} />
    </SceneSvg>
  );
}
