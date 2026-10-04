'use client';

/**
 * 큰 화면 모드(/gung/scene?code=7F3K5) — 노트북·TV 에 「이동한 곳」 그림만 크게 띄운다(원고 7판 10-1 「이동은 다 같이」).
 *
 *  - 비밀이 없다: 사건 표식(코드 대조용 공개 단어쌍)·조사 칩·이동 연출(그림·장소 이름·이동 한 줄·살펴보기 안내)뿐.
 *    관찰 글·물건 이름표·본 물건 표시는 없다 — 살펴보기는 각자 폰에서(7판). 방 코드·자리·역할은 어디에도 그리지 않는다.
 *  - **관찰 누출 차단**: 사건 데이터(case-data.ts)·현장 엔진(scene.ts)을 import 하지 않는다. 이동 표는 같은 원고 표에서 만든
 *    공개 모듈 scene-route-data.ts(장소 이름·그림 키·살펴보기 수·이동 한 줄)만 쓴다 → 이 페이지 번들엔 관찰 글이 없다.
 *  - 역할 무관: assign·seal·game 저장(gu:game:v1)은 import 하지도 읽지도 쓰지도 않는다 — 같은 브라우저에 방장 판이 있어도 따라가지 않는다.
 *  - 서버가 없으니 방장 폰과 자동으로 맞춰지지 않는다. 조사 칩을 이 기기에서 직접 고른다.
 *    ②③ 을 처음 열 때만 확인 한 번(「방장이 '둘째 조사를 시작하오'라고 한 뒤에만」). 되돌아가는 건 자유.
 *  - 코드는 없어도 된다(이동은 인원과 무관). 있으면 사건 표식을 보여 주고 조사 칩 기록을 그 판으로 나눈다(gu:scene:v2).
 */
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SCENE_ROUTE } from '@/lib/gung/scene-route-data';
import { normalizeCode, parseRoomCode } from '@/lib/gung/room';
import { GUIDE } from '@/lib/gung/guide-data';
import { BottomSheet } from '../components/BottomSheet';
import { GuButton } from '../components/GuButton';
import { useWakeLock } from '../lib/useWakeLock';
import { useBigScreenRound } from '../lib/sceneStore';
import { SceneMove } from '../screens/SceneMove';

type Round = 1 | 2 | 3;
const ROUNDS: readonly Round[] = [1, 2, 3];
const ROUND_WORD: Record<Round, string> = { 1: '첫째', 2: '둘째', 3: '셋째' };
const DIGIT: Record<Round, string> = { 1: '1', 2: '2', 3: '3' };

export function SceneStandalone() {
  const params = useSearchParams();
  const raw = params?.get('code') ?? '';
  const room = raw ? parseRoomCode(normalizeCode(raw)) : null;
  const codeBad = Boolean(raw) && !room;
  const store = useBigScreenRound(room?.code ?? null);
  const [ask, setAsk] = useState<Round | null>(null);
  useWakeLock(true, false);

  const pick = (r: Round) => {
    if (r <= store.opened) store.setRound(r);
    else setAsk(r);
  };
  const stop = SCENE_ROUTE.find((s) => s.round === store.round) ?? null;

  return (
    <div className="gu-scenebig">
      <header className="gu-scenebig-head">
        <h1 className="gu-scenebig-title">
          <span className="gu-scenebig-name gu-display">{GUIDE.sceneLabel}</span>
          {room && <span className="gu-scenebig-tag">사건 표식 · {room.tag}</span>}
        </h1>
        <div className="gu-scenebig-rounds" role="group" aria-label="조사">
          <span className="gu-scenebig-roundlabel" aria-hidden>
            조사
          </span>
          {ROUNDS.map((r) => (
            <button
              key={r}
              type="button"
              className="gu-scenebig-chip"
              aria-pressed={store.ready && store.round === r}
              aria-label={`${ROUND_WORD[r]} 조사`}
              onClick={() => pick(r)}
            >
              {DIGIT[r]}
            </button>
          ))}
        </div>
      </header>
      <main className="gu-scenebig-body">
        {codeBad && <p className="gu-scenebig-note">방 코드를 알아볼 수 없소. 그림은 그대로 볼 수 있소</p>}
        {room && <p className="gu-scenebig-note">사건 표식이 방장 화면과 같은지 보시오</p>}
        {store.ready ? <SceneMove stop={stop} wide idScope="big" /> : <div className="gu-boot" />}
      </main>
      <BottomSheet title={ask ? `${ROUND_WORD[ask]} 조사 현장을 열겠소?` : ''} open={ask !== null} onClose={() => setAsk(null)}>
        {ask && (
          <>
            <p className="gu-sheet-body-text">방장이 &apos;{ROUND_WORD[ask]} 조사를 시작하오&apos;라고 한 뒤에만 누르시오.</p>
            <div className="gu-sheet-actions-row">
              <GuButton variant="secondary" onClick={() => setAsk(null)}>
                아직이오
              </GuButton>
              <GuButton
                variant="primary"
                onClick={() => {
                  store.setRound(ask);
                  setAsk(null);
                }}
              >
                열겠소
              </GuButton>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
