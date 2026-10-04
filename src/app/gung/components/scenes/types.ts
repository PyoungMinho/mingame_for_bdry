/**
 * 현장 그림 레지스트리 타입 — 그림 키('scene-dg') → 그림 컴포넌트 + 핫스팟 자리 + 짧은 이름표.
 * 사건 데이터(case-data.ts 의 scenes[].objects[].pos)는 원고 10-3 초안 자리다. 그림이 나왔으니 그림에 맞춘 자리를
 * 여기 anchors 로 둔다(원고 10-3: 「그림이 나오면 맞춰 고친다」). 데이터 pos 보다 이쪽이 이긴다.
 */
import type { ComponentType } from 'react';

export interface SceneArtProps {
  /**
   * 그 조사 라운드(1..3). 7판: 그림은 공용 화면에도 뜨므로 관찰 줄의 겉모습을 라운드 따라 그리지 않는다 — 지금 그림들은 쓰지 않는다
   * (새 그림이 공용으로 보여도 되는 라운드 변화를 그릴 때만 쓴다).
   */
  round: number;
  /** SVG id 고정 범위(같은 화면에 그림이 둘이면 서로 다른 값). 없으면 useId */
  idScope?: string;
}

export interface SceneArtDef {
  /** 'scene-dg' — 사건 데이터 SceneDef.art 와 같은 키 */
  key: string;
  Art: ComponentType<SceneArtProps>;
  /** 물건 id → 핫스팟 중심 [가로 %, 세로 %] (그림에 맞춘 자리) */
  anchors: Readonly<Record<string, readonly [number, number]>>;
  /** 물건 id → 그림 위 짧은 이름표(≤ 6자, 데이터 이름에서 줄인 말만). 없으면 데이터 이름 */
  labels: Readonly<Record<string, string>>;
}
