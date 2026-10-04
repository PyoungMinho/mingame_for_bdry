/**
 * 「세자 독살 사건」 현장 이동 — 공개 데이터(7판 조사 따로: 이동은 다 같이).
 *
 * 이 파일은 손으로 고치지 말 것 — `docs/planning/gung-case.md` §10-2 이동 표에서 `scratchpad/gung/to-ts.py` 가
 * case-data.ts 와 함께 만든다. 장소 이름·그림 키·살펴보기 수·이동 한 줄만 담는다 — 관찰 글·카드·역할은 없다.
 * 큰 화면(/gung/scene)은 case-data.ts 대신 이 파일만 import 한다(관찰 누출 차단). case-data.ts 의 sceneRoute 와
 * 같은지는 scene.test.ts 가 대조한다.
 */
import type { PublicSceneStop } from './types';

export const SCENE_ROUTE: readonly PublicSceneStop[] = [
  {
    "round": 1,
    "placeId": "dg",
    "placeName": "동궁전",
    "art": "scene-dg",
    "examine": 2,
    "cue": "모두 동궁전으로. 저하께서 쓰러지신 침전이오."
  },
  {
    "round": 2,
    "placeId": "ny",
    "placeName": "내의원",
    "art": "scene-ny",
    "examine": 2,
    "cue": "모두 내의원으로. 그 탕약을 달인 곳이오."
  },
  {
    "round": 3,
    "placeId": "dg",
    "placeName": "동궁전",
    "art": "scene-dg",
    "examine": 2,
    "cue": "다시 동궁전으로. 날이 밝기 전 마지막으로 보시오."
  }
];
