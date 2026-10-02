/**
 * §5-7 SealedCard 쪽 나눔 — 꾹 누르는 동안엔 스크롤할 수 없으므로(touch-action:none) 한 번에 보이는 분량으로 자른다.
 * "넘치면 1/2 쪽 칩(쪽 전환은 손 뗀 뒤 칩 탭 → 다시 꾹)". 순수 표시 로직 — 사건 본문을 바꾸지 않는다.
 *
 * 기준 분량(PAGE_CHARS): 375×667 에서 호패/단서 카드가 엄지로 누른 채 한 화면에 들어오는 대략치(17px 본문 ≈ 10줄).
 */
export const PAGE_CHARS = 160;

/** 문단(\n\n) → 문장 단위로 쪼갠 뒤 budget 안에서 욕심껏 묶는다. 한 문장이 budget 보다 길면 그 문장 혼자 한 쪽. */
export function paginateText(text: string, budget = PAGE_CHARS): string[] {
  const t = text.trim();
  if (t.length <= budget) return [t];
  const units: { s: string; br: boolean }[] = [];
  for (const para of t.split(/\n{2,}/)) {
    // lookbehind 정규식은 iOS Safari 16.4 미만(구형 카톡 인앱)에서 파싱 에러로 앱 전체를 죽인다 → 치환 후 분리
    const sentences = para.replace(/([.!?。…」』)])\s+/g, '$1\u0000').split('\u0000').filter(Boolean);
    sentences.forEach((s, i) => units.push({ s, br: i === 0 && units.length > 0 }));
  }
  const pages: string[] = [];
  let cur = '';
  for (const u of units) {
    const joiner = cur ? (u.br ? '\n\n' : ' ') : '';
    if (cur && cur.length + joiner.length + u.s.length > budget) {
      pages.push(cur);
      cur = u.s;
    } else {
      cur += joiner + u.s;
    }
  }
  if (cur) pages.push(cur);
  return pages;
}

/** 목록(거짓말·말투·그날 밤)은 항목을 쪼개지 않고 budget 안에서 묶는다 */
export function paginateItems<T>(items: readonly T[], size: (item: T) => number, budget = PAGE_CHARS): T[][] {
  const pages: T[][] = [];
  let cur: T[] = [];
  let used = 0;
  for (const it of items) {
    const n = size(it);
    if (cur.length && used + n > budget) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(it);
    used += n;
  }
  if (cur.length || !pages.length) pages.push(cur);
  return pages;
}
