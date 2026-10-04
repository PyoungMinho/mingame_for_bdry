/**
 * 현장 그림 7장 레지스트리(원고 10-2) — 사건 데이터 SceneDef.art 키('scene-dg' …) → 그림 + 핫스팟 자리 + 짧은 이름표.
 * 프레젠테이션 전용: 엔진·사건 데이터 import 없음(역할 무관). 화면 조립은 screens/SceneView.tsx.
 */
import { sceneDg } from './SceneDg';
import { sceneHw } from './SceneHw';
import { sceneJg } from './SceneJg';
import { sceneNg } from './SceneNg';
import { sceneNy } from './SceneNy';
import { sceneSg } from './SceneSg';
import { sceneSr } from './SceneSr';
import type { SceneArtDef } from './types';

export type { SceneArtDef, SceneArtProps } from './types';
export { SceneFallbackArt } from './SceneFallback';

export const SCENE_ARTS: Readonly<Record<string, SceneArtDef>> = Object.fromEntries(
  [sceneDg, sceneSg, sceneSr, sceneNy, sceneHw, sceneJg, sceneNg].map((d) => [d.key, d]),
);

/** 그림 키로 찾기 — 없으면 null(SceneView 가 SceneFallbackArt 로 그린다) */
export function sceneArt(key: string): SceneArtDef | null {
  return Object.prototype.hasOwnProperty.call(SCENE_ARTS, key) ? SCENE_ARTS[key] : null;
}
