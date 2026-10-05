/**
 * 「목격자는 AI」 엔진 공개 API — UI(src/app/witness)는 여기서만 가져온다.
 * 경로 탐색·정적 검사(validate.ts)는 테스트·QA 전용이라 내보내지 않는다.
 */
export * from './types';
export { CASE, NAMES } from './case-data';
export * from './engine';
export * from './storage';
export * from './share';
export * from './readlines';
