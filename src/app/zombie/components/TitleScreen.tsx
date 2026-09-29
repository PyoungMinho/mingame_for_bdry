'use client';

import { AlertTriangle, BookOpen, Play, RotateCcw, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { ENDING_IDS, LOCATIONS } from '@/lib/zombie/contract';
import { NODES } from '@/lib/zombie/content';
import { formatClock, type RunState } from '@/lib/zombie/engine';
import type { FoundEndings } from '../lib/useZombieGame';
import { SceneArt } from '../scenes';
import { EndingGallery } from './EndingGallery';
import { Drawer } from './Panels';

export function TitleScreen({
  saved,
  found,
  storageOk,
  onStart,
  onResume,
  onViewEnding,
}: {
  saved: RunState | null;
  found: FoundEndings;
  storageOk: boolean;
  onStart: () => void;
  onResume: () => void;
  onViewEnding: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [gallery, setGallery] = useState(false);
  const resumable = saved && !saved.ending ? saved : null;
  const foundN = ENDING_IDS.filter((id) => found[id]).length;
  const sceneCount = Object.keys(NODES).length;

  return (
    <main className="zb-title">
      <div className="zb-title-bg" aria-hidden>
        <SceneArt id="balcony_view" />
      </div>
      <div className="zb-title-inner">
        <div className="zb-title-alert" role="note">
          <p className="zb-title-alert-head">
            <AlertTriangle aria-hidden />
            긴급재난문자 <span>[행정안전부]</span>
          </p>
          <p>오늘 14:02 서울 전역 원인불명 집단 폭력사태 발생. 외출 자제, 문단속 철저. 물린 사람과 접촉 금지.</p>
        </div>

        <h1 className="zb-logo">
          <span>좀비</span>
          <span>터지면</span>
        </h1>
        <p className="zb-tagline">서울 생존 시뮬레이션 — 너라면, 어떻게 할 건데?</p>

        <div className="zb-title-actions">
          {resumable && (
            <button type="button" className="zb-btn zb-btn-primary" onClick={onResume}>
              <Play aria-hidden />
              이어하기
              <small>
                {formatClock(resumable.clock)} · {LOCATIONS[NODES[resumable.nodeId]?.location ?? 'home'].name}
              </small>
            </button>
          )}
          {resumable && !confirm ? (
            <button type="button" className="zb-btn" onClick={() => setConfirm(true)}>
              <RotateCcw aria-hidden />
              처음부터
            </button>
          ) : resumable && confirm ? (
            <div className="zb-confirm" role="group" aria-label="새 게임 확인">
              <p>진행 중인 기록이 사라집니다.</p>
              <button type="button" className="zb-btn zb-btn-danger" onClick={onStart}>
                새로 시작
              </button>
              <button type="button" className="zb-btn zb-btn-ghost" onClick={() => setConfirm(false)}>
                취소
              </button>
            </div>
          ) : (
            <button type="button" className="zb-btn zb-btn-primary zb-btn-xl" onClick={onStart}>
              <Play aria-hidden />
              {saved?.ending ? '다시 살아남기' : '시작하기'}
            </button>
          )}
          {saved?.ending && (
            <button type="button" className="zb-btn zb-btn-ghost" onClick={onViewEnding}>
              <ScrollText aria-hidden />
              지난 결말 보기
            </button>
          )}
          <button type="button" className="zb-btn zb-btn-ghost" onClick={() => setGallery(true)}>
            <BookOpen aria-hidden />
            엔딩 도감 {foundN}/{ENDING_IDS.length}
          </button>
        </div>

        <ul className="zb-title-meta" aria-label="게임 정보">
          <li>5장 · {sceneCount}개 장면</li>
          <li>{ENDING_IDS.length}개 엔딩</li>
          <li>한 판 25~30분</li>
        </ul>
        <p className="zb-fine">
          선택은 되돌릴 수 없어요.{' '}
          {storageOk ? '진행은 이 기기에 자동 저장됩니다.' : '이 브라우저에선 진행이 저장되지 않아요(시크릿 모드 등).'}
        </p>
      </div>

      <Drawer title="엔딩 도감" open={gallery} onClose={() => setGallery(false)}>
        <div className="zb-panel-body">
          <EndingGallery found={found} inDialog />
        </div>
      </Drawer>
    </main>
  );
}
