/**
 * 숨기기 시트 업종 3종의 개발·테스트용 스펙 — 문구 팩 JSON이 아직 없을 때 쓰는 대역 (소유: 컴포넌트개발자).
 * 실제 서비스는 문구 팩의 `disguise` 필드를 그대로 넘긴다(모양이 같다). 문구 원문은 디자인 최종안 §6-2.
 * 순수 데이터. 실제 게임 화면 문구의 출처가 아니다.
 */
import type { DisguiseSpec } from './disguise';

const rows = (codes: readonly string[], names: readonly string[]) => codes.map((code, i) => ({ code, name: names[i] }));

export const ACCOUNTING_SPEC: DisguiseSpec = {
  title: '계정별 결산 대비표',
  subtitle: '기준: 당월 마감 · 단위: 천원',
  columns: [
    { head: '코드', width: 72, format: 'code', maxChars: 4 },
    { head: '계정과목', width: 168, format: 'txt', maxChars: 11 },
    { head: '전월', width: 96, format: 'num', maxChars: 9 },
    { head: '당월', width: 96, format: 'num', maxChars: 9 },
    { head: '증감', width: 96, format: 'num', maxChars: 9 },
    { head: '증감률', width: 80, format: 'pct', maxChars: 7 },
    { head: '예산', width: 96, format: 'num', maxChars: 9 },
    { head: '집행률', width: 80, format: 'pct', maxChars: 7 },
    { head: '구분', width: 80, format: 'code', maxChars: 4 },
    { head: '담당', width: 72, format: 'code', maxChars: 5 },
  ],
  groups: [
    {
      name: '판매비와관리비',
      subtotal: '판관비 소계',
      rows: rows(['8110', '8120', '8130', '8140', '8150', '8160'], ['복리후생비', '여비교통비', '접대비', '통신비', '소모품비', '지급수수료']),
    },
    {
      name: '영업외비용',
      subtotal: '영업외 소계',
      rows: rows(['9310', '9320', '9330', '9340', '9350'], ['이자비용', '외환차손', '기부금', '잡손실', '유형자산처분손실']),
    },
  ],
  totalLabel: '합계',
  rule: { kind: 'accounting', current: [1000, 90000], prevDeltaPct: 25, budgetPct: [90, 120], classes: ['고정', '변동'], owners: ['AC-1', 'AC-2', 'AC-3'] },
  chart: { title: '계정별 전월·당월', baselinePct: null },
  firstCell: 'D4',
  note: '※ 금액은 천원 단위, 마감 후 변경 시 재결재 필요',
};

export const SALES_SPEC: DisguiseSpec = {
  title: '채널별 목표 대비 실적',
  subtitle: '기준: 분기 누계 · 단위: 천원',
  columns: [
    { head: '구분', width: 72, format: 'code', maxChars: 4 },
    { head: '채널·캠페인', width: 168, format: 'txt', maxChars: 11 },
    { head: '목표', width: 96, format: 'num', maxChars: 9 },
    { head: '실적', width: 96, format: 'num', maxChars: 9 },
    { head: '달성률', width: 96, format: 'pct', maxChars: 7 },
    { head: '전월', width: 96, format: 'num', maxChars: 9 },
    { head: '증감', width: 88, format: 'num', maxChars: 9 },
    { head: '건수', width: 72, format: 'num', maxChars: 5 },
    { head: '객단가', width: 88, format: 'num', maxChars: 7 },
    { head: '순위', width: 56, format: 'code', maxChars: 2 },
  ],
  groups: [
    {
      name: '온라인',
      subtotal: '온라인 소계',
      rows: rows(['온라인', '온라인', '온라인', '온라인', '온라인', '온라인'], ['검색광고', '디스플레이광고', '자사몰', '오픈마켓', '제휴 채널', '이메일 캠페인']),
    },
    {
      name: '오프라인',
      subtotal: '오프라인 소계',
      rows: rows(['오프라인', '오프라인', '오프라인', '오프라인', '오프라인'], ['직영 매장', '대리점', '전시회', '기업 특판', '방문 영업']),
    },
  ],
  totalLabel: '합계',
  rule: { kind: 'sales', target: [10000, 500000], achievePct: [60, 130], count: [10, 400] },
  chart: { title: '채널별 달성률', baselinePct: 100 },
  firstCell: 'D4',
  note: '※ 달성률은 목표 대비 실적 기준',
};

export const HR_SPEC: DisguiseSpec = {
  title: '팀별 연차 사용 현황',
  subtitle: '기준일: {date} · 단위: 일',
  columns: [
    { head: '팀 코드', width: 80, format: 'code', maxChars: 5 },
    { head: '부문', width: 136, format: 'txt', maxChars: 9 },
    { head: '정원', width: 64, format: 'num', maxChars: 3 },
    { head: '현원', width: 64, format: 'num', maxChars: 3 },
    { head: '발생', width: 80, format: 'dec1', maxChars: 5 },
    { head: '사용', width: 80, format: 'dec1', maxChars: 5 },
    { head: '잔여', width: 80, format: 'dec1', maxChars: 5 },
    { head: '사용률', width: 88, format: 'pct', maxChars: 7 },
    { head: '기준일', width: 104, format: 'date', maxChars: 10 },
    { head: '비고', width: 96, format: 'txt', maxChars: 6 },
  ],
  groups: [
    {
      name: '경영지원부문',
      subtotal: '경영지원 소계',
      rows: rows(['T-101', 'T-102', 'T-103', 'T-104', 'T-105', 'T-106'], ['인사기획', '총무', '재무지원', '법무', '구매', '시설관리']),
    },
    {
      name: '사업부문',
      subtotal: '사업 소계',
      rows: rows(['T-201', 'T-202', 'T-203', 'T-204', 'T-205'], ['영업1', '영업2', '마케팅', '개발', '운영']),
    },
  ],
  totalLabel: '합계',
  rule: { kind: 'hr', headcount: [6, 40], vacancyMax: 2, accrualPerHead: [15.0, 16.5], usagePct: [20, 85] },
  chart: { title: '팀별 연차 사용률', baselinePct: 70 },
  firstCell: 'F4',
  note: '※ 사용률은 발생 대비 사용 기준',
};

export const DISGUISE_FIXTURES = { accounting: ACCOUNTING_SPEC, sales: SALES_SPEC, hr: HR_SPEC } as const;
