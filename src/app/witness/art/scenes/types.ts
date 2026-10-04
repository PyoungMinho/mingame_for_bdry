/**
 * 장소 그림 레지스트리 타입 — 사건 데이터 `Location.art` 키('living' …) → 그림 컴포넌트 + 핫스팟 좌표 맵.
 *
 * anchors 는 사건 데이터(src/lib/witness/case-data.ts)의 `Hotspot.x/y` 와 **같은 값**이다(디자인 D10 반영 좌표).
 * 그림은 이 좌표 중심에 해당 물건을 그렸다. 좌표의 원본은 엔진 데이터이고, 여기 값은 그림이 맞춘 자리의 사본이다
 * — 데이터 좌표를 바꾸면 그림도 옮기고 이 표도 고친다(art.test 가 둘을 대조한다).
 * 해금 전 핫스팟(L0.h5 먼지통 등)도 물건은 그림에 있다. 점과 레일만 숨긴다(D09).
 */
import type { ComponentType } from 'react';

export type SceneKey = 'living' | 'kitchen' | 'study' | 'utility' | 'roof' | 'guest';

export interface SceneArtProps {
  /** SVG id 고정 범위(같은 화면에 그림 둘이면 서로 다른 값). 없으면 useId */
  idScope?: string;
  /** 창의 비 루프(기본 켬). 꺼도 빗줄기는 정적으로 남는다 */
  rain?: boolean;
  /** 추가 클래스(.wt-art-scene 에 더해짐) */
  className?: string;
  /** preserveAspectRatio. 컨테이너가 정확히 3:2(폭 = 높이 × 1.5)면 차이 없음. 기본 'slice' */
  fit?: 'slice' | 'meet';
}

export interface SceneArtDef {
  key: SceneKey;
  /** 장소 이름(디버그·대체 텍스트용) */
  name: string;
  Art: ComponentType<SceneArtProps>;
  /** 핫스팟 id → [가로 %, 세로 %] — 사건 데이터와 같은 값 */
  anchors: Readonly<Record<string, readonly [number, number]>>;
  /** 장면 기본 톤(대사 패널 상단선·로딩 배경 등에 쓸 수 있는 hex) */
  tone: string;
}
