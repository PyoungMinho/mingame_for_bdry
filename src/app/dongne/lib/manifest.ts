/**
 * 동네고수 — manifest.json 접근 계층 (페이지개발자 소유)
 *
 * manifest.json은 250개 전량이 자동완성·채점에 필수라 초기 로드가 OK한 데이터다(방향서 §2-1
 * "① manifest.json ... 초기 로드 OK" — silhouettes와 달리 이 파일은 정적 top-level import가
 * 의도된 설계다). 실루엣(silhouettes/{code}.json)만 온디맨드 동적 import 대상이다(useGame.ts 참고).
 */

import manifestData from '../data/manifest.json';
import type { Region } from '@/lib/dongne/types';

export const REGIONS: Region[] = manifestData as Region[];

const REGION_BY_CODE: Map<string, Region> = new Map(REGIONS.map((r) => [r.code, r]));

export function getRegionByCode(code: string): Region | undefined {
  return REGION_BY_CODE.get(code);
}

/**
 * code → 표시명("동명이면 (시도)"가 이미 포함된 문자열, 예: "고성군(강원)").
 * `GuessList`의 `regionNames` prop, 아카이브 목록/공유 텍스트 등 이름 조회가 필요한 곳에서 공용.
 */
export const REGION_NAME_MAP: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.code, r.nameWithSido]),
);
