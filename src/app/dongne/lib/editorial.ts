/**
 * '어제의 동네' 해설 콘텐츠 로더 (페이지개발자 소유 — 스키마도 이 파일이 잠정 정의한다)
 *
 * ⚠ 통합 메모: 방향서 §3 "PM 직접" 절은 콘텐츠 산출물 경로를
 * `src/app/dongne/data/content/<code>.md`(마크다운)로 적어 두었다. 반면 이 페이지의 임무
 * 지시서는 `src/app/dongne/data/editorial/{code}.json`(JSON)을 명시한다 — 스탯카드(인구·면적)를
 * 구조화된 필드로 뽑으려면 JSON이 유리해 임무 지시를 따랐지만, 두 문서가 가리키는 경로/포맷이
 * 다르다는 점은 프론트팀장·콘텐츠 파이프라인 담당자가 통합 시 반드시 정리해야 한다.
 *
 * 아래 스키마는 이 페이지가 필요로 하는 최소 형태를 페이지개발자가 잠정 제안한 것이다(콘텐츠
 * 파이프라인 담당자가 확정하지 않았으므로). 파일이 없으면(콘텐츠 파이프라인 착수 전 — 현재
 * 250개 전부 미존재) throw/404 없이 조용히 null을 반환하고, 호출측(archive/[gameNo]/page.tsx)이
 * "기본 팩트만"으로 폴백한다(임무 지시 명문).
 */

/**
 * 실제 시드 JSON 스키마와 1:1 (src/app/dongne/data/editorial/{code}.json, 60편).
 * 이전 버전은 `{population, area, sections[]}`를 기대했으나 실제 데이터는
 * `{intro, body[], facts{}, sources[]}` 형태여서 소비측(archive/[gameNo]/page.tsx)이
 * `editorial.sections.length`에서 TypeError로 크래시했다(QA BUG-1). 계약을 실데이터로 정합.
 * 모든 필드는 optional — 파일이 없거나(현재 190개 미존재) 필드가 빠져도 호출측이 "기본 팩트만"으로 폴백한다.
 */
export interface EditorialContent {
  code: string;
  name?: string;
  sido?: string;
  /** 리드 문단(굵게 요약) */
  intro?: string;
  /** 본문 문단 배열 */
  body?: string[];
  /** 스탯카드용 라벨→값 (예: {"인구":"약 42만 명","명물":"…","한줄매력":"…"}) */
  facts?: Record<string, string>;
  /** 출처 URL (렌더 미사용, 검증·감사 용도) */
  sources?: string[];
}

export async function loadEditorial(code: string): Promise<EditorialContent | null> {
  try {
    const mod = await import(`../data/editorial/${code}.json`);
    return (mod.default ?? mod) as EditorialContent;
  } catch {
    return null;
  }
}
