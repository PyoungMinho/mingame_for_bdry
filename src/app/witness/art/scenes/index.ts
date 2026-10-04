/**
 * 장소 그림 레지스트리 — 사건 데이터 `Location.art` 키 → 그림 + 핫스팟 좌표(%).
 * 프레젠테이션 전용: 엔진·사건 데이터 import 없음. 화면 조립은 components/SceneView(프론트).
 *
 * 쓰는 법:
 *   const def = sceneArt(location.art);           // 없으면 null → SceneFallbackArt
 *   <def.Art idScope={location.id} rain={fx !== 'reduced'} />
 *   핫스팟 점은 데이터의 hotspot.x/y(%)로 그린다. def.anchors 는 같은 값의 사본(대조 테스트용).
 */
import { sceneGuest } from './Guest';
import { sceneKitchen } from './Kitchen';
import { sceneLiving } from './Living';
import { sceneRoof } from './Roof';
import { sceneStudy } from './Study';
import { sceneUtility } from './Utility';
import type { SceneArtDef, SceneKey } from './types';

export type { SceneArtDef, SceneArtProps, SceneKey } from './types';
export { SceneFallbackArt } from './Fallback';
export { LivingArt } from './Living';
export { KitchenArt } from './Kitchen';
export { StudyArt } from './Study';
export { UtilityArt } from './Utility';
export { RoofArt } from './Roof';
export { GuestArt } from './Guest';

export const SCENE_ARTS: Readonly<Record<SceneKey, SceneArtDef>> = {
  living: sceneLiving,
  kitchen: sceneKitchen,
  study: sceneStudy,
  utility: sceneUtility,
  roof: sceneRoof,
  guest: sceneGuest,
};

/** 그림 키로 찾기 — 없으면 null(부르는 쪽이 SceneFallbackArt 로 그린다) */
export function sceneArt(key: string): SceneArtDef | null {
  return Object.prototype.hasOwnProperty.call(SCENE_ARTS, key) ? SCENE_ARTS[key as SceneKey] : null;
}

/** 장소 그림 핫스팟 좌표 맵 — { 'living': { 'L0.h1': [50, 62], … }, … } */
export const SCENE_HOTSPOTS: Readonly<Record<SceneKey, SceneArtDef['anchors']>> = {
  living: sceneLiving.anchors,
  kitchen: sceneKitchen.anchors,
  study: sceneStudy.anchors,
  utility: sceneUtility.anchors,
  roof: sceneRoof.anchors,
  guest: sceneGuest.anchors,
};
