import type { ComponentType } from 'react';
import type { SceneId } from '@/lib/zombie/types';
import { sceneGroupA } from './a';
import { sceneGroupB } from './b';
import { sceneGroupC } from './c';
import { sceneGroupD } from './d';
import { sceneGroupE } from './e';
import { sceneGroupF } from './f';
import { sceneGroupG } from './g';
import { SceneSvg, Sky, Vignette } from './primitives';
import { sceneReference } from './reference';

export const SCENE_COMPONENTS: Partial<Record<SceneId, ComponentType>> = {
  ...sceneReference,
  ...sceneGroupA,
  ...sceneGroupB,
  ...sceneGroupC,
  ...sceneGroupD,
  ...sceneGroupE,
  ...sceneGroupF,
  ...sceneGroupG,
};

/** 씬이 아직 없을 때의 대체 화면 — 어두운 대기 그라디언트만 */
function FallbackScene() {
  return (
    <SceneSvg>
      <Sky
        id="zs-fallback-sky"
        stops={[
          [0, '#05090B'],
          [0.6, '#15292B'],
          [1, '#0B1618'],
        ]}
      />
      <Vignette id="zs-fallback-vig" />
    </SceneSvg>
  );
}

export function SceneArt({ id }: { id: SceneId }) {
  const Comp = SCENE_COMPONENTS[id] ?? FallbackScene;
  return <Comp />;
}
