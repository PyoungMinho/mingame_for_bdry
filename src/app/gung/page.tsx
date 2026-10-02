import { Suspense } from 'react';
import { GungApp } from './screens/GungApp';

/**
 * §1-1: GungApp이 useSearchParams(?code=&as=host&v=)를 쓰므로 Suspense로 감싼다(Next 14 정적 렌더 요구).
 */
export default function GungPage() {
  return (
    <Suspense fallback={<div className="gu-boot" />}>
      <GungApp />
    </Suspense>
  );
}
