'use client';

/**
 * 이동 연출(공용) — 원고 7판 10-1 「이동은 다 같이」. 방장 무대(현장 보기 하위 단계)와 큰 화면(/gung/scene)이 같이 쓴다.
 *
 *  - 보이는 것: 옮겨 간 장소의 그림 · 「조사 N · 이동」 · 장소 이름 · 이동 한 줄(방장이 외친다) · 「각자 폰에서 물건 둘을 살펴보시오」.
 *  - **관찰 글·물건 이름표·「새」 표시는 없다** — 무엇을 보는지는 각자 폰에서만(ExaminePanel). 방장은 관찰을 읽지 않는다.
 *  - **누출 차단**: 이 파일은 사건 데이터(case-data)·현장 엔진(scene.ts)을 import 하지 않는다. 부르는 쪽이 공개 이동 데이터
 *    (PublicSceneStop — 방장은 scene.sceneStop, 큰 화면은 scene-route-data.ts)만 넘긴다. 역할·자리·인원도 받지 않는다.
 *  - 방장 무대는 타이머 때문에 1초마다 다시 그려진다 → memo, 그림 SVG 는 (그림·라운드·idScope) 로 memo.
 *  - 이동 연출: 조사가 바뀌면 그림·글판이 살짝 떠오르며 들어온다(CSS gu-move-in, 동작 줄이기 설정이면 없음).
 */
import { memo, useMemo } from 'react';
import type { PublicSceneStop } from '@/lib/gung/types';
import { GUIDE, guideText } from '@/lib/gung/guide-data';
import { sceneArt, SceneFallbackArt } from '../components/scenes';

export interface SceneMoveProps {
  /** 그 조사의 이동 한 곳(공개 데이터). null = 조사 전·이동 표 없음 */
  stop: PublicSceneStop | null;
  /** 큰 화면 모드 — 900px 이상에서 그림 | 글 두 단 */
  wide?: boolean;
  /** 그림 SVG id 고정 범위(한 화면에 그림이 둘이면 서로 다른 값). 방장 'host' · 큰 화면 'big' */
  idScope?: string;
  className?: string;
}

function SceneMoveImpl({ stop, wide = false, idScope, className }: SceneMoveProps) {
  const ArtComp = (stop && sceneArt(stop.art)?.Art) || SceneFallbackArt;
  const round = stop?.round ?? 1;
  const artNode = useMemo(() => <ArtComp round={round} idScope={idScope} />, [ArtComp, round, idScope]);
  if (!stop) {
    return (
      <section className={['gu-scene', 'gu-scene--empty', className ?? ''].filter(Boolean).join(' ')} aria-label={GUIDE.sceneLabel}>
        <p className="gu-scene-emptytext">조사가 시작되면 현장이 열리오</p>
      </section>
    );
  }
  return (
    <section
      className={['gu-move', wide ? 'gu-move--wide' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-label={`${GUIDE.sceneLabel} · ${stop.placeName}`}
      data-round={stop.round}
      data-place={stop.placeId}
    >
      {/* key = 조사 — 조사가 바뀌면(같은 동궁전으로 돌아와도) 옮겨 가는 연출(살짝 떠오름)을 다시 한다 */}
      <div key={`art-${stop.round}`} className="gu-scene-canvas gu-move-canvas" data-place={stop.placeId}>
        {artNode}
      </div>
      <div key={`plate-${stop.round}`} className="gu-move-plate">
        <p className="gu-move-kicker">
          조사 <span className="gu-num">{stop.round}</span> · {GUIDE.moveTag}
        </p>
        <h3 className="gu-move-place gu-display">{stop.placeName}</h3>
        <p className="gu-move-cue">「{stop.cue}」</p>
        <p className="gu-move-examine">{guideText.examineCue(stop.examine)}</p>
      </div>
    </section>
  );
}

/** 방장 무대(1초 타이머 재렌더)에서 props 가 같으면 다시 그리지 않는다 — stop 은 같은 라운드면 같은 값(부르는 쪽 useMemo/모듈 상수) */
export const SceneMove = memo(SceneMoveImpl);
