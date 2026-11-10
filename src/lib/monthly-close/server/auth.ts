/**
 * 월마감 인증 (소유: API설계자). 브라우저 비밀키(MC_KEY_RE, 128비트) → SHA-256 해시.
 * Supabase Auth는 쓰지 않는다. 비밀키 원문은 이 파일 밖으로 나가지 않고, 로그·오류·화면 데이터에 남기지 않는다.
 * 비밀키는 헤더 `x-mc-key`로만 받는다(URL 금지).
 */

import { createHash } from 'node:crypto';
import { MC_KEY_HEADER, MC_KEY_RE, MC_TEST_HEADER } from '../protocol';

export interface Identity {
  /** SHA-256 hex(64자) — 저장·비교에 쓰는 값 */
  readonly keyHash: string;
  /** 테스트 표시 헤더(x-mc-test: 1) → 방·매치·이벤트가 is_test로 기록된다 */
  readonly isTest: boolean;
  /** 메모리 안에서만 횟수를 세는 용도(저장 금지). 모르면 'unknown' */
  readonly ip: string;
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

const firstOf = (v: string | null): string => (v ? v.split(',')[0].trim() : '');

/**
 * 남용 제한(IP 버킷)용 클라이언트 IP. (QA BUG-11)
 *  - Vercel(`VERCEL=1`): 플랫폼이 붙이는 값만 쓴다. `x-real-ip` → `x-vercel-forwarded-for` → `x-forwarded-for` 순.
 *    Vercel 문서상 셋 다 플랫폼이 접속 IP로 채우고 클라이언트가 보낸 `x-forwarded-for`는 덮어쓴다(IP 위조 방지).
 *    배포 후 POST-04(매 요청 x-forwarded-for를 바꿔 없는 번호 join 70회 → 61번째부터 RATE_LIMITED)로 확인한다.
 *  - 로컬·테스트: 예전 그대로 `x-forwarded-for` 첫 값 → `x-real-ip`(QA 스크립트가 가짜 XFF로 버킷을 나눈다).
 */
export function clientIp(headers: Headers, onVercel: boolean = process.env.VERCEL === '1'): string {
  const ip = onVercel
    ? firstOf(headers.get('x-real-ip')) || firstOf(headers.get('x-vercel-forwarded-for')) || firstOf(headers.get('x-forwarded-for'))
    : firstOf(headers.get('x-forwarded-for')) || firstOf(headers.get('x-real-ip'));
  return ip.slice(0, 64) || 'unknown';
}

/** 헤더에서 신원 추출. 헤더가 없거나 형식이 다르면 null(INVALID reason 'key'). */
export function identityFromHeaders(headers: Headers, onVercel: boolean = process.env.VERCEL === '1'): Identity | null {
  const key = headers.get(MC_KEY_HEADER);
  if (key === null || !MC_KEY_RE.test(key)) return null;
  return { keyHash: hashKey(key), isTest: headers.get(MC_TEST_HEADER) === '1', ip: clientIp(headers, onVercel) };
}
