/**
 * 툰일기 공유 상수 — 카피/정책/디자인 값의 단일 출처.
 * 출처: design-final.md §6/§8, project-direction.md §3(가격)/§2(아키텍처)
 */
import type {
  ArtStyleKey,
  AvatarAccessory,
  AvatarHairColor,
  AvatarTopStyle,
  BalloonType,
  Tier,
} from "./contract";

/* ─── 법무: AI 생성 고지 (전 티어 필수, 프로도 제거 불가 — design-final §8.2) ───
 * ⚠️ 법무 1차 자문 후 문구 최종 확정 → 이 상수만 갱신(컴포넌트 수정 불필요). */
export const AI_DISCLOSURE_TEXT = "AI 생성 이미지 · Made with Toonlog" as const;
export const AI_DISCLOSURE_BADGE_TEXT = "AI 생성" as const;

/* ─── 일기 입력 제한 (design-final §10 충돌해소 #1) ─── */
export const DIARY_TEXT_MIN = 50;
export const DIARY_TEXT_MAX = 300;

/* ─── 말풍선 타입별 글자수 상한 (design-final §6.3) ─── */
export const BALLOON_CHAR_LIMITS: Record<BalloonType, number> = {
  speech: 50,
  thought: 50,
  shout: 20,
  whisper: 40,
};

/* ─── react-konva 캔버스 핸들 크기 (design-final §10 충돌해소 #2) ─── */
export const KONVA_HANDLE_SIZE = 48; // px (일반 UI 터치 타깃은 44px)
export const TOUCH_TARGET_MIN = 44; // px

/* ─── 무료/공유 해상도 (design-final §7.2 / §10 충돌해소 #3) ─── */
export const PREVIEW_SIZE = 512; // 무료 미리보기/뷰어 다운스케일
export const SHARE_CARD_SIZE = 1080; // 공유 카드 1:1 기준

/* ─── 화풍 4종 (UI 노출명 — design-final §6.1) ─── */
export interface ArtStyleMeta {
  key: ArtStyleKey;
  name: string; // UI 한글명
  desc: string;
}
export const ART_STYLES: ArtStyleMeta[] = [
  { key: "emotional_line", name: "감성 라인", desc: "가늘고 부드러운 선, 잔잔한 파스텔" },
  { key: "bold_pen", name: "대담한 펜선", desc: "굵은 펜선과 강한 흑백 대비" },
  { key: "pop_cartoon", name: "팝 카툰", desc: "선명하고 쨍한 고채도 카툰" },
  { key: "watercolor_touch", name: "수채 터치", desc: "번지는 수채 질감, 따뜻한 색" },
];
export const DEFAULT_ART_STYLE: ArtStyleKey = "emotional_line";

/* ─── 아바타 옵션 (design-final §6.2) ─── */
export const AVATAR_HAIR_COLORS: AvatarHairColor[] = [
  "black", "brown", "blonde", "red", "pink", "blue", "green", "white",
];
export const AVATAR_TOP_STYLES: AvatarTopStyle[] = [
  "white-top", "stripe", "hoodie", "uniform", "casual", "formal", "sport", "vintage",
];
export const AVATAR_ACCESSORIES: AvatarAccessory[] = ["glasses", "hat", "earphone", "none"];

/** 신규 유저 기본 아바타 (W2 디자인 8종 default 보강 전 임시 기본값) */
export const DEFAULT_AVATAR = {
  hairColor: "black" as AvatarHairColor,
  topStyle: "white-top" as AvatarTopStyle,
  accessory: "none" as AvatarAccessory,
};

/* ─── 얼굴 일관성 (project-direction 아키텍처 #3) ─── */
export const FACE_EMBEDDING_THRESHOLD = 0.85;
export const CONSISTENCY_MAX_RETRY = 2;

/* ─── 가격 정책 (project-direction §3.2) ─── */
export interface TierMeta {
  key: Tier;
  name: string;
  monthly: number; // 원
  yearly: number; // 원 (2개월 무료)
  monthlyQuota: number; // 월 컷 수 (free는 일 1)
  watermark: "large" | "small" | "off";
}
export const TIERS: Record<Tier, TierMeta> = {
  free: { key: "free", name: "무료", monthly: 0, yearly: 0, monthlyQuota: 30 /* 일1*30 */, watermark: "large" },
  basic: { key: "basic", name: "베이직", monthly: 9900, yearly: 99000, monthlyQuota: 90 /* 일3*30 */, watermark: "small" },
  pro: { key: "pro", name: "프로", monthly: 17900, yearly: 179000, monthlyQuota: 150, watermark: "off" },
};

/** 크레딧 팩 (project-direction §3.2) */
export const CREDIT_PACKS = [
  { credits: 1, price: 2000 },
  { credits: 5, price: 7900 },
  { credits: 12, price: 15900 },
];

export const FREE_DAILY_LIMIT = 1;
export const BETA_EARLYBIRD_DISCOUNT = 0.3; // 평생 30%

/* ─── 워터마크 tier 분기 (design-final §8.1) ─── */
export const WATERMARK_CONFIG: Record<Tier, { show: boolean; withQR: boolean; opacity: number }> = {
  free: { show: true, withQR: true, opacity: 0.92 },
  basic: { show: true, withQR: false, opacity: 0.6 },
  pro: { show: false, withQR: false, opacity: 0 },
};

/* ─── 라우트 (design-final §3) ─── */
export const ROUTES = {
  landing: "/",
  onboarding: "/onboarding",
  home: "/home",
  diaryNew: "/diary/new",
  diaryGenerating: (id: string) => `/diary/generating/${id}`,
  diary: (id: string) => `/diary/${id}`,
  diaryEdit: (id: string) => `/diary/${id}/edit`,
  diaryShare: (id: string) => `/diary/${id}/share`,
  archive: "/archive",
  mypage: "/mypage",
  upgrade: "/mypage/upgrade",
  sharePublic: (id: string) => `/share/${id}`,
} as const;

export const THEME_STORAGE_KEY = "toonlog-theme";
