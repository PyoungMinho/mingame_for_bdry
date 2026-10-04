/**
 * 그림이 아직 없는 장소용 바탕(사건 데이터에 새 장소가 생겼을 때의 안전망) — 창호와 등잔 하나뿐인 빈 방.
 */
import type { SceneArtProps } from './types';
import { C, CommonDefs, Glow, Lattice, MaruFloor, OilLamp, SceneSvg, useSvgIds, Vignette } from './parts';

export function SceneFallbackArt({ idScope }: SceneArtProps) {
  const ids = useSvgIds('fb', idScope);
  return (
    <SceneSvg label="scene-fallback">
      <defs>
        <CommonDefs ids={ids} />
      </defs>
      <rect width="1600" height="1000" fill={C.night1} />
      <rect width="1600" height="560" fill={C.wall} />
      <Lattice ids={ids} x={560} y={160} w={480} h={300} cols={5} rows={4} />
      <MaruFloor x={0} y={560} w={1600} h={440} />
      <Glow ids={ids} cx={800} cy={420} r={520} />
      <OilLamp x={800} y={640} h={240} />
      <Vignette ids={ids} />
    </SceneSvg>
  );
}
