'use client';

/**
 * 그림 진입점 — 모든 화면은 그림을 이 컴포넌트로만 그린다(장면·초상·소개 컷·엔딩 키아트).
 * 최종 아트(src/app/witness/art/WitnessArt)에 위임한다. 예비 단색 실루엣 구현은 ArtPlaceholder.tsx 에 남아 있어,
 * 아트 모듈을 못 쓰는 환경이면 아래 한 줄을 `export { ArtPlaceholder as ArtSlot, type ArtProps } from './ArtPlaceholder';` 로 바꾼다.
 *
 * props 계약(두 구현 공통):
 *  - kind="scene"    art = Location.art 키. 1500×1000(3:2), 부모를 채운다. 핫스팟 점·비 오버레이는 이 밖에서 얹는다.
 *  - kind="portrait" who = Speaker | 'VICTIM', face, crop('bust'|'head'). 표정 3종 상주 + 오버레이. 최종 아트는 smirk·trust·speaking 도 받는다.
 *  - kind="cut"      art = IntroCut.art 키. 4:3.
 *  - kind="ending"   ending = EndingId. 16:10. (최종 아트는 완벽 해결 키아트용 culprit 도 받는다)
 */
export { WitnessArt as ArtSlot, type WitnessArtProps as ArtProps } from '../art/WitnessArt';
