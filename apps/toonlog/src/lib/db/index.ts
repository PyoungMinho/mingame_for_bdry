/**
 * src/lib/db — 툰일기 DB 모듈 공개 인터페이스
 *
 * API설계자는 이 파일만 import 한다.
 *   import { createDiary, getQuota, tryConsumeQuota, ... } from "@/lib/db";
 *
 * 모듈 구성:
 *   client      — supabaseServer() / supabaseBrowser()
 *   diaries     — createDiary / getDiary / listDiaries / updateDiaryStatus / savePanels
 *   jobs        — createJob / updateJobStage / getJob / failJob
 *   quota       — getQuota / tryConsumeQuota / refundQuota
 *   credits     — getCredits / consumeCredits / addCredits
 *   subscriptions — getSubscription / upsertSubscription / cancelSubscription
 *   profiles    — getProfile / upsertProfile / rememberLastSettings
 */

// ── 클라이언트 ──────────────────────────────
export { supabaseServer, supabaseBrowser } from "./client";

// ── 일기 + 패널 ─────────────────────────────
export {
  createDiary,
  getDiary,
  listDiaries,
  updateDiaryStatus,
  savePanels,
  updatePanelBalloons,
  softDeleteDiary,
  type ListDiariesOptions,
} from "./diaries";

// ── 생성 잡 ─────────────────────────────────
export {
  createJob,
  updateJobStage,
  getJob,
  getLatestJobByDiary,
  failJob,
} from "./jobs";

// ── Quota ────────────────────────────────────
export {
  getQuota,
  tryConsumeQuota,
  refundQuota,
} from "./quota";

// ── 크레딧 ──────────────────────────────────
export {
  getCredits,
  consumeCredits,
  addCredits,
  listCreditHistory,
} from "./credits";

// ── 구독 ─────────────────────────────────────
export {
  getSubscription,
  upsertSubscription,
  cancelSubscription,
  expireSubscriptions,
  type SubscriptionInput,
} from "./subscriptions";

// ── 프로필 ───────────────────────────────────
export {
  getProfile,
  upsertProfile,
  rememberLastSettings,
  type ProfileUpdateInput,
} from "./profiles";

// ── 타입 ─────────────────────────────────────
export type {
  Database,
  ProfileRow,
  DiaryRow,
  PanelRow,
  GenerationJobRow,
  SubscriptionRow,
  CreditsLedgerRow,
  QuotaUsageRow,
  ShareCardRow,
} from "./types";
