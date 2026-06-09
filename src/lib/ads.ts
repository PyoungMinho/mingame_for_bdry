/**
 * Google AdSense 설정 (학생 무료 모드 광고 수익).
 * 게시자(client) ID는 시크릿이 아니라 모든 애드센스 사이트 소스에 공개되는 값이다.
 * 광고 단위(slot) ID는 애드센스 대시보드에서 '광고 단위'를 만들면 발급된다.
 * 슬롯이 비어 있으면 프로덕션에서 해당 광고 자리는 렌더되지 않는다(빈 박스 방지).
 */

/** 애드센스 계정(게시자) ID — ca-pub-XXXX */
export const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-1055429146881844";

/**
 * 광고 자리별 슬롯 ID. 대시보드에서 단위 생성 후 Vercel 환경변수로 주입하면
 * 코드 수정 없이 실제 광고가 그 자리에 붙는다. (미설정 시 프로덕션에서 미표시)
 */
export const AD_SLOTS = {
  homeBanner: process.env.NEXT_PUBLIC_AD_SLOT_HOME_BANNER || "",
  studyTop: process.env.NEXT_PUBLIC_AD_SLOT_STUDY_TOP || "",
  studyInline: process.env.NEXT_PUBLIC_AD_SLOT_STUDY_INLINE || "",
  studyResult: process.env.NEXT_PUBLIC_AD_SLOT_STUDY_RESULT || "",
} as const;

/** 광고 스크립트·단위를 실제 로드할지 — 개발/데모에서는 끈다(자기 광고 클릭 정책 위반·트래커 방지) */
export const ADS_ENABLED = process.env.NODE_ENV === "production" && !!ADSENSE_CLIENT;
