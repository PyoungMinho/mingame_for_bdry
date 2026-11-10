import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/**
 * `.mc-root` — layout.tsx 최상위 래퍼. 토큰·공유 스타일 누수 덮어쓰기가 이 범위 안에서만 작동한다.
 * monthly-close.css 는 페이지개발자의 layout.tsx 에서 import 한다.
 */
export function McRoot({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('mc-root', className)} />;
}
