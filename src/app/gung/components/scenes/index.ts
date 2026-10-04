/**
 * 현장 그림 레지스트리(원고 10-5) — 사건 데이터 그림 키('scene-dg' …) → 그림 + 핫스팟 자리 + 짧은 이름표.
 * 7판(조사 따로): 이동 장소는 동궁전·내의원 둘뿐이라 그림도 둘이다(6판의 서고·수라간·후원 연못·중궁전·내관 처소 그림은 뺐다 — 원고 9-9 ⑥).
 * 프레젠테이션 전용: 엔진·사건 데이터 import 없음(역할 무관). 화면 조립은 screens/SceneMove.tsx(공용 이동)·ExaminePanel.tsx(개인 살펴보기).
 */
import { sceneDg } from './SceneDg';
import { sceneNy } from './SceneNy';
import type { SceneArtDef } from './types';

export type { SceneArtDef, SceneArtProps } from './types';
export { SceneFallbackArt } from './SceneFallback';

export const SCENE_ARTS: Readonly<Record<string, SceneArtDef>> = Object.fromEntries(
  [sceneDg, sceneNy].map((d) => [d.key, d]),
);

/** 그림 키로 찾기 — 없으면 null(부르는 쪽이 SceneFallbackArt 로 그린다) */
export function sceneArt(key: string): SceneArtDef | null {
  return Object.prototype.hasOwnProperty.call(SCENE_ARTS, key) ? SCENE_ARTS[key] : null;
}
