import type { ComponentType } from 'react';
import { sceneGroupA } from './a';
import { sceneGroupB } from './b';
import { sceneGroupC } from './c';
import { sceneGroupD } from './d';
import { sceneGroupE } from './e';
import { sceneGroupF } from './f';
import { SceneSvg, Sky, Vignette } from './primitives';
import { sceneReference } from './reference';

export const SCENE_COMPONENTS: Record<string, ComponentType> = {
  ...sceneReference,
  ...sceneGroupA,
  ...sceneGroupB,
  ...sceneGroupC,
  ...sceneGroupD,
  ...sceneGroupE,
  ...sceneGroupF,
};

function FallbackScene() {
  return (
    <SceneSvg>
      <Sky id="rs-fallback-sky" stops={[[0, '#1A140E'], [0.6, '#3A2A1A'], [1, '#120E0A']]} />
      <Vignette id="rs-fallback-vig" />
    </SceneSvg>
  );
}

export function SceneArt({ id }: { id: string }) {
  const Comp = SCENE_COMPONENTS[id] ?? FallbackScene;
  return <Comp />;
}
