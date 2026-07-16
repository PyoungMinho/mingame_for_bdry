'use client';

import Link from 'next/link';
import {
  SilhouetteFrame,
  GuessInput,
  GuessList,
  ResultCard,
  ShareButtons,
  StreakChip,
  TownBadge,
  OnboardingStrip,
  StatsHistogram,
  CountdownChip,
  NudgeBanner,
  StorageUnavailableNotice,
} from './components';
import DongneHeader from './lib/Header';
import { useDongneGame, type DongneGame } from './lib/useGame';
import { REGIONS, REGION_NAME_MAP } from './lib/manifest';
import { buildShareText, SHARE_URL } from '@/lib/dongne/share';
import type { Region } from '@/lib/dongne/types';

/**
 * 동네고수 게임 본체 (design-final §5-1~5-5, 방향서 §2 코어 게임 루프).
 *
 * 전체가 로컬스토리지·타이머·자동완성 폼 인터랙션이라 클라이언트 컴포넌트로 둔다 —
 * manifest.json은 빌드타임 top-level import(초기 로드 OK, 방향서 §2-1)라 fetch 로딩 상태가
 * 필요 없고, 실루엣만 `lib/useGame.ts`가 코드별 동적 import로 온디맨드 로드한다.
 *
 * 정답 렌더 금지 가드(design-final §9 필수 가드 #2): `today`(정답 Region)는 힌트 계산을 위해
 * 항상 메모리에 있지만, 이름/centroid는 `status !== 'playing'`이 된 뒤에만 하위로 넘긴다 —
 * 이 파일 안에서 `today.nameWithSido`를 참조하는 곳은 전부 그 가드를 통과한 지점뿐이다.
 */
export default function DongnePage() {
  const game = useDongneGame();

  if (game.gameNo < 1) {
    return (
      <main className="dn-container dn-prelaunch">
        <h1 className="dn-text-h1">동네고수가 곧 시작돼요</h1>
        <p className="dn-text-body">매일 자정, 새로운 동네가 공개됩니다. 조금만 기다려주세요!</p>
      </main>
    );
  }

  const silhouetteFrameState =
    game.status === 'won'
      ? 'correct'
      : game.status === 'lost'
        ? 'failed'
        : game.silhouetteState === 'ready'
          ? 'playing'
          : game.silhouetteState;

  return (
    <main className="dn-container dn-game" onClickCapture={game.pingOnce}>
      <DongneHeader gameNo={game.gameNo} />

      {!game.onboarded && game.status === 'playing' ? (
        <OnboardingStrip onStart={game.dismissOnboarding} />
      ) : null}

      {game.showNudge ? (
        <NudgeBanner streak={game.stats.currentStreak} onDismiss={game.dismissStreakRisk} />
      ) : null}

      <SilhouetteFrame
        state={silhouetteFrameState}
        silhouette={game.silhouette ?? undefined}
        answerName={game.status === 'lost' && game.today ? game.today.nameWithSido : undefined}
        onRetry={game.retrySilhouette}
      />

      <GuessList guesses={game.guesses} regionNames={REGION_NAME_MAP} status={game.status} />

      {game.status === 'playing' ? (
        <GuessInput regions={REGIONS} excludedCodes={game.guessedCodes} onSubmit={game.submitGuess} />
      ) : null}

      {game.status !== 'playing' && game.today ? (
        <ResultSection game={game} status={game.status} today={game.today} />
      ) : null}

      {game.showStorageNotice ? (
        <StorageUnavailableNotice onDismiss={game.dismissStorageNotice} />
      ) : null}
    </main>
  );
}

/**
 * 결과 카드 조립 — `status`/`today`를 non-null로 좁힌 채 받는 별도 컴포넌트로 분리해서
 * (a) 부모의 옵셔널 체이닝 없이 안전하게 정답명을 읽고 (b) 공유 텍스트·통계 하이라이트 인덱스
 * 계산을 결과 화면 전용으로 격리한다.
 */
function ResultSection({
  game,
  status,
  today,
}: {
  game: DongneGame;
  status: 'won' | 'lost';
  today: Region;
}) {
  const shareText = buildShareText({
    gameNo: game.gameNo,
    status,
    guesses: game.guesses,
    streak: game.stats.currentStreak,
  });

  const todayResultIndex =
    game.stats.lastPlayedGameNo === game.gameNo
      ? status === 'won'
        ? game.guesses.length - 1
        : 6
      : undefined;

  return (
    <ResultCard
      status={status}
      attemptsUsed={game.guesses.length}
      answerName={today.nameWithSido}
      streakSlot={
        <StreakChip streak={game.stats.currentStreak} maxStreak={game.stats.maxStreak} variant="label" />
      }
      townBadgeSlot={
        <>
          <TownBadge
            status={status}
            registered={!!game.hometownCode}
            isMyTownAnswer={game.hometownCode === today.code}
            onRegisterClick={game.openHometownPicker}
            onChangeClick={game.openHometownPicker}
          />
          {game.settingHometown ? (
            <>
              <GuessInput
                regions={REGIONS}
                onSubmit={game.registerHometown}
                placeholder="우리 동네를 검색하세요"
              />
              <button type="button" className="dn-btn-ghost" onClick={game.closeHometownPicker}>
                취소
              </button>
            </>
          ) : null}
        </>
      }
      shareSlot={<ShareButtons shareText={shareText} shareUrl={`https://${SHARE_URL}`} />}
      countdownSlot={<CountdownChip />}
      archiveHref={game.gameNo > 1 ? `/dongne/archive/${game.gameNo - 1}` : undefined}
      statsSlot={
        game.storageAvailable ? (
          <StatsHistogram stats={game.stats} todayResultIndex={todayResultIndex} />
        ) : undefined
      }
      footerSlot={
        <>
          <Link href="/dongne/about" className="dn-link">
            소개
          </Link>
          <Link href="/dongne/privacy" className="dn-link">
            개인정보
          </Link>
          <Link href="/dongne/contact" className="dn-link">
            문의
          </Link>
        </>
      }
    />
  );
}
