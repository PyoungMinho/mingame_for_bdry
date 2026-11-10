'use client';

/**
 * 박대리 연습(/practice): 같은 GameScreen + usePracticeRoom. 서버·지표 없음.
 * mock이 있으면(`?mock=playing|ended&i=0..2`) 고정 판을 그린다(G0-5 눈테스트용 정지 화면).
 * 끝나면 "동료 초대" 큰 버튼 → 홈(공유 문서 만들기).
 */
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { IndustryId } from '@/lib/monthly-close/constants';
import { mockEndedView, mockPlayingView } from '@/lib/monthly-close/client/mockViews';
import { setPracticeDone } from '@/lib/monthly-close/client/identity';
import { createStaticController } from '@/lib/monthly-close/client/staticController';
import { usePracticeRoom } from '@/lib/monthly-close/client/usePracticeRoom';
import { ViewStore } from '@/lib/monthly-close/client/viewStore';
import { GameScreen } from './GameScreen';

export function PracticeApp({ mock, industry }: { mock: 'playing' | 'ended' | null; industry: IndustryId }) {
  return mock ? <MockApp mock={mock} industry={industry} /> : <LiveApp industry={industry} />;
}

function LiveApp({ industry }: { industry: IndustryId }) {
  const router = useRouter();
  const [store] = useState(() => new ViewStore('game'));
  const c = usePracticeRoom(industry);
  const done = c.practice?.done ?? false;
  useEffect(() => {
    if (done) setPracticeDone();
  }, [done]);
  return (
    <GameScreen
      controller={c}
      store={store}
      mode="practice"
      roomCode={null}
      initialIndustry={industry}
      coachLine={c.practice?.coachLine}
      coachStep={c.practice ? `${c.practice.cut}/${c.practice.totalCuts}` : undefined}
      partnerTaunt={c.partnerTaunt}
      onHome={() => router.push('/monthly-close')}
      onNewDoc={() => router.push('/monthly-close')}
      onInvite={() => router.push('/monthly-close')}
    />
  );
}

function MockApp({ mock, industry }: { mock: 'playing' | 'ended'; industry: IndustryId }) {
  const router = useRouter();
  const [store] = useState(() => new ViewStore('game'));
  const controller = useMemo(() => {
    const now = Date.now();
    return createStaticController(mock === 'ended' ? mockEndedView(industry, now) : mockPlayingView(industry, now));
  }, [mock, industry]);
  return <GameScreen controller={controller} store={store} mode="practice" roomCode={null} initialIndustry={industry} onHome={() => router.push('/monthly-close')} />;
}
