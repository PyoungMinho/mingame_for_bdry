/**
 * 「목격자는 AI」 그림 모듈(src/app/witness/art) — 프레젠테이션 전용. 엔진·사건 데이터는 타입만 import.
 *
 *  WitnessArt            ArtSlot 과 같은 props 의 통합 진입점(장면·초상·소개 컷·엔딩) + art.css import
 *  scenes/               장소 6곳(1500×1000) + SCENE_HOTSPOTS 좌표 맵(사건 데이터와 같은 값)
 *  portraits/            용의자 4 · 한결 · 또박이(표정 3 + 오버레이) · 나(실루엣) · Portrait(who) 스위치
 *  fx/                   판정 컷인 스트립 · 유리 균열 · 결정적/모순 해소/다 털었다 도장 · 등급 도장
 *  intro/ · ending/      사건 소개 8컷(4:3) · 엔딩 키아트 9종(16:10) · 피해자 액자
 *  art.css               비·LED·이퀄라이저·호흡·컷인·균열·도장·경광등 키프레임(.wt-shell 스코프, 줄이기·숨김 대응)
 */
export { WitnessArt, type WitnessArtProps } from './WitnessArt';
export * from './scenes/index';
export * from './portraits/index';
export * from './fx/index';
export * from './intro/index';
export { EndingArt } from './ending/EndingArt';
export { SpeakerBody, LED_COLOR, type LedState } from './speaker';
