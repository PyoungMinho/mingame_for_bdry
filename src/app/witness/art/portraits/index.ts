/**
 * 인물 초상 — 용의자 4 + 한결 + 또박이(6종 × 표정 3 + 오버레이) + 나(탐정 실루엣).
 *
 * 쓰는 법:
 *   <Portrait who="S2" face="sweat" />                      // CharacterStage
 *   <Portrait who="S1" face="normal" smirk />               // 오답 리액션(비웃음 오버레이)
 *   <Portrait who="COP" trust={run.trust} crop="head" />    // HUD 한결 아바타
 *   <Portrait who="AI" face="angry" speaking />             // 또박이 권한 거부(빨강) + 이퀄라이저
 * Face: normal·sweat·break 는 그림, shock = sweat 포즈 + 놀란 눈 + 스파크(점프는 art.css),
 *       angry = normal 포즈 + V 눈썹 + 핏줄, smirk = normal 포즈 + 한쪽 입꼬리. 4명 모두 같은 규칙(D34).
 */
export type { ArtFace, PortraitProps, Look } from './parts';
export { lookOf } from './parts';
export { SungangPortrait } from './Sungang';
export { HaneulPortrait } from './Haneul';
export { MisukPortrait } from './Misuk';
export { JunhyeokPortrait } from './Junhyeok';
export { HangyeolPortrait, hangyeolLook, type TrustLevel } from './Hangyeol';
export { DdobagiPortrait, ledOf } from './Ddobagi';
export { DetectivePortrait } from './Detective';
export { Portrait, PORTRAIT_WHO, hasPortrait, type PortraitWho } from './Portrait';
