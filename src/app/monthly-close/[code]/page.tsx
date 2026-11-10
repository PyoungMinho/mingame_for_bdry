import { notFound } from 'next/navigation';
import { ROOM_CODE_RE } from '@/lib/monthly-close/protocol';
import { RoomApp } from '../_screens/RoomApp';

/**
 * 방(/monthly-close/[code]): 서버 컴포넌트는 5자리 숫자인지만 검사한다(방 상태 SSR 금지, 방향서 §4-2).
 * 단계(대기·배치·대전·결과)와 예외(꽉 참·없음·점검)는 모두 클라이언트 섬(RoomApp) 안의 상태다.
 */
export default function RoomPage({ params }: { params: { code: string } }) {
  if (!ROOM_CODE_RE.test(params.code)) notFound();
  return <RoomApp code={params.code} />;
}
