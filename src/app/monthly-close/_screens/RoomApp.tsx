'use client';

/** 방 클라이언트 섬(/monthly-close/[code]): useMcRoom(실서버) + GameScreen. 상태는 서버에서 그리지 않는다. */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { peekFreshRoom } from '@/lib/monthly-close/client/identity';
import { useMcRoom } from '@/lib/monthly-close/client/useMcRoom';
import { ViewStore } from '@/lib/monthly-close/client/viewStore';
import { GameScreen } from './GameScreen';

export function RoomApp({ code }: { code: string }) {
  const router = useRouter();
  const [store] = useState(() => new ViewStore('game'));
  // 첫 sync: 다시 열기(자리 있음)는 숨김으로 시작하므로 'disguise'로 보고한다(BUG-17). 홈에서 방금 만든 방만 'game'.
  // 자리가 없는 사람(입장 대화상자)은 서버가 view를 쓰지 않는다(접근 실패가 touch보다 먼저).
  const controller = useMcRoom(code, () => store.view, () => (peekFreshRoom(code) ? 'game' : 'disguise'));
  return (
    <GameScreen
      controller={controller}
      store={store}
      mode="room"
      roomCode={code}
      onHome={() => router.push('/monthly-close')}
      onPractice={() => router.push('/monthly-close/practice')}
      onNewDoc={() => router.push('/monthly-close')}
    />
  );
}
