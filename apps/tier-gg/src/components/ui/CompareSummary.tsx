/**
 * CompareSummary.tsx
 * 비교 페이지 상단 자동 요약 카드
 *
 * - 순수 서버 컴포넌트 (클라이언트 디렉티브 없음)
 * - 규칙 기반 자동 생성: 각 메트릭에서 10% 이상 차이가 나는 경우만 bullet에 포함
 * - 10% 미만 차이는 "비슷한 수준"으로 묶음
 * - betterWhen 기준으로 우위 모델 자동 판정
 */

export interface CompareSummaryModel {
  name: string;
  slug: string;
  provider: string;
  attrs: {
    priceInput?: number | null;
    priceOutput?: number | null;
    contextWindow?: number | null;
  };
  scores: {
    mmlu?: number | null;
    humaneval?: number | null;
    gpqa?: number | null;
    arenaElo?: number | null;
    speedTps?: number | null;
  };
}

export interface CompareSummaryProps {
  models: CompareSummaryModel[];
  locale?: string;
}

interface MetricDef {
  key: string;
  label: { en: string; ko: string };
  betterWhen: 'higher' | 'lower';
  format: (v: number) => string;
  unit: { en: string; ko: string };
  getValue: (m: CompareSummaryModel) => number | null | undefined;
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: 'priceInput',
    label: { en: 'input price', ko: '입력 가격' },
    betterWhen: 'lower',
    format: (v) => `$${v}`,
    unit: { en: 'per 1M tokens', ko: '/1M 토큰' },
    getValue: (m) => m.attrs.priceInput,
  },
  {
    key: 'priceOutput',
    label: { en: 'output price', ko: '출력 가격' },
    betterWhen: 'lower',
    format: (v) => `$${v}`,
    unit: { en: 'per 1M tokens', ko: '/1M 토큰' },
    getValue: (m) => m.attrs.priceOutput,
  },
  {
    key: 'contextWindow',
    label: { en: 'context window', ko: '컨텍스트 창' },
    betterWhen: 'higher',
    format: (v) => `${v}K`,
    unit: { en: 'tokens', ko: '토큰' },
    getValue: (m) => m.attrs.contextWindow,
  },
  {
    key: 'mmlu',
    label: { en: 'general knowledge (MMLU)', ko: '종합 지식 (MMLU)' },
    betterWhen: 'higher',
    format: (v) => `${v}%`,
    unit: { en: '', ko: '' },
    getValue: (m) => m.scores.mmlu,
  },
  {
    key: 'humaneval',
    label: { en: 'coding ability (HumanEval)', ko: '코딩 능력 (HumanEval)' },
    betterWhen: 'higher',
    format: (v) => `${v}%`,
    unit: { en: '', ko: '' },
    getValue: (m) => m.scores.humaneval,
  },
  {
    key: 'gpqa',
    label: { en: 'deep reasoning (GPQA)', ko: '심화 추론 (GPQA)' },
    betterWhen: 'higher',
    format: (v) => `${v}%`,
    unit: { en: '', ko: '' },
    getValue: (m) => m.scores.gpqa,
  },
  {
    key: 'arenaElo',
    label: { en: 'user preference (Arena Elo)', ko: '사용자 선호 (Arena Elo)' },
    betterWhen: 'higher',
    format: (v) => `${v}`,
    unit: { en: 'pts', ko: 'pts' },
    getValue: (m) => m.scores.arenaElo,
  },
  {
    key: 'speedTps',
    label: { en: 'speed', ko: '응답 속도' },
    betterWhen: 'higher',
    format: (v) => `${v}`,
    unit: { en: 'tok/s', ko: 'tok/s' },
    getValue: (m) => m.scores.speedTps,
  },
];

/** 두 값 사이에 10% 이상 상대 차이가 있는지 확인 */
function isSignificant(a: number, b: number): boolean {
  const larger = Math.max(a, b);
  if (larger === 0) return false;
  return Math.abs(a - b) / larger >= 0.1;
}

interface BulletItem {
  winner: string;
  text: { en: string; ko: string };
}

function generateBullets(
  models: CompareSummaryModel[],
): { bullets: BulletItem[]; tieCount: number } {
  if (models.length < 2) return { bullets: [], tieCount: 0 };

  const [modelA, modelB] = models;
  const bullets: BulletItem[] = [];
  let tieCount = 0;

  for (const def of METRIC_DEFS) {
    const valA = def.getValue(modelA);
    const valB = def.getValue(modelB);

    if (valA == null || valB == null) continue;

    if (!isSignificant(valA, valB)) {
      tieCount++;
      continue;
    }

    // 우위 판정: betterWhen 기준
    const winnerModel =
      def.betterWhen === 'higher'
        ? valA > valB ? modelA : modelB
        : valA < valB ? modelA : modelB;

    const loserModel = winnerModel === modelA ? modelB : modelA;
    const winnerVal = def.getValue(winnerModel)!;
    const loserVal = def.getValue(loserModel)!;

    const unitEn = def.unit.en ? ` ${def.unit.en}` : '';
    const unitKo = def.unit.ko ? ` ${def.unit.ko}` : '';

    bullets.push({
      winner: winnerModel.name,
      text: {
        en: `**${winnerModel.name}** has better ${def.label.en} (${def.format(winnerVal)}${unitEn} vs ${def.format(loserVal)}${unitEn})`,
        ko: `**${winnerModel.name}**의 ${def.label.ko}이 더 우수 (${def.format(winnerVal)}${unitKo} vs ${def.format(loserVal)}${unitKo})`,
      },
    });
  }

  return { bullets, tieCount };
}

function generateHeadline(
  models: CompareSummaryModel[],
  bullets: BulletItem[],
  tieCount: number,
): { en: string; ko: string } {
  if (models.length < 2) {
    return { en: 'Comparison summary', ko: '비교 요약' };
  }

  const [modelA, modelB] = models;

  if (bullets.length === 0) {
    return {
      en: `${modelA.name} and ${modelB.name} are very similar overall`,
      ko: `${modelA.name}과 ${modelB.name}은 전반적으로 매우 비슷합니다`,
    };
  }

  // 어느 모델이 더 많이 이겼는지 확인
  const winsA = bullets.filter((b) => b.winner === modelA.name).length;
  const winsB = bullets.filter((b) => b.winner === modelB.name).length;

  if (winsA > winsB) {
    return {
      en: `${modelA.name} edges ahead — here's the breakdown`,
      ko: `${modelA.name}이 전반적으로 앞섭니다 — 차이점은 다음과 같아요`,
    };
  } else if (winsB > winsA) {
    return {
      en: `${modelB.name} edges ahead — here's the breakdown`,
      ko: `${modelB.name}이 전반적으로 앞섭니다 — 차이점은 다음과 같아요`,
    };
  }

  return {
    en: 'Both are strong picks — here\'s how they differ',
    ko: '둘 다 강력합니다 — 차이점은 다음과 같아요',
  };
}

/** **bold** 마크다운을 <strong> 태그로 변환 */
function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-[var(--color-text-primary)]">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

import * as React from 'react';

export function CompareSummary({ models, locale = 'en' }: CompareSummaryProps) {
  if (models.length < 2) return null;

  const { bullets, tieCount } = generateBullets(models);
  const headline = generateHeadline(models, bullets, tieCount);
  const isKo = locale === 'ko';

  const headlineText = isKo ? headline.ko : headline.en;

  return (
    <div
      className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-4"
      aria-label={isKo ? '비교 요약' : 'Comparison summary'}
    >
      {/* 헤드라인 */}
      <p className="text-[15px] font-bold text-[var(--color-text-primary)] mb-2">
        {headlineText}
      </p>

      {/* 우위 항목 bullets */}
      {bullets.length > 0 && (
        <ul className="flex flex-col gap-1.5 mb-2">
          {bullets.map((bullet, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[13px] text-[var(--color-text-secondary)]"
            >
              <span
                className="mt-[3px] shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
                aria-hidden="true"
              />
              <span>{renderBold(isKo ? bullet.text.ko : bullet.text.en)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 비슷한 항목 요약 */}
      {tieCount > 0 && (
        <p className="text-[12px] text-[var(--color-text-muted)]">
          {isKo
            ? `나머지 ${tieCount}개 항목은 두 모델이 비슷한 수준입니다.`
            : `${tieCount} other metric${tieCount > 1 ? 's are' : ' is'} roughly the same between the two models.`}
        </p>
      )}
    </div>
  );
}
