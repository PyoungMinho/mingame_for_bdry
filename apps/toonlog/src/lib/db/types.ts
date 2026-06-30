/**
 * Supabase DB 타입 정의
 * - 스키마 SSOT: supabase/migrations/20260603000001_initial_schema.sql
 * - 앱 레이어 공유 타입 SSOT: src/lib/contract.ts
 *
 * 이 파일은 DB Row 타입만 정의한다.
 * API 요청/응답 DTO 는 contract.ts 를 사용한다.
 */

import type { ArtStyleKey, AvatarConfig, BalloonMeta, DiaryStatus, JobStage, Tier } from "../contract";

// ──────────────────────────────────────────
// Row 타입 (supabase-js 제네릭용)
// ──────────────────────────────────────────

export type ProfileRow = {
  id: string;
  tier: Tier;
  avatar: AvatarConfig;
  default_art_style: ArtStyleKey;
  theme: "system" | "light" | "dark";
  beta_earlybird: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type DiaryRow = {
  id: string;
  user_id: string;
  /** 앱 레이어에서 암호화된 원문. getDecryptedText() 로 복호화 후 사용 */
  text: string;
  art_style: ArtStyleKey;
  /** AvatarConfig 스냅샷 */
  avatar: AvatarConfig;
  status: DiaryStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type PanelRow = {
  id: string;
  diary_id: string;
  panel_index: 1 | 2 | 3 | 4;
  image_url: string | null;
  preview_url: string | null;
  caption: string | null;
  balloons: BalloonMeta[];
  created_at: string;
}

export type GenerationJobRow = {
  id: string;
  diary_id: string;
  stage: JobStage;
  completed_panels: number;
  total_panels: 4;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionRow = {
  id: string;
  user_id: string;
  tier: "basic" | "pro";
  period: "monthly" | "yearly";
  toss_billing_key: string | null;
  status: "active" | "cancelled" | "expired" | "paused";
  started_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type CreditsLedgerRow = {
  id: string;
  user_id: string;
  delta: number;
  reason: string;
  balance_after: number;
  created_at: string;
}

export type QuotaUsageRow = {
  user_id: string;
  usage_date: string; // YYYY-MM-DD
  day_count: number;
  period_month: string; // YYYY-MM
  month_count: number;
  updated_at: string;
}

export type ShareCardRow = {
  id: string;
  diary_id: string;
  ratio: "1:1" | "16:9" | "9:16";
  url: string;
  created_at: string;
}

// ──────────────────────────────────────────
// Database 제네릭 타입 (createClient<Database> 에 전달)
// ──────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        // id(=auth user id)만 필수, 나머지는 DB DEFAULT/nullable → 선택
        Insert: Pick<ProfileRow, "id"> & Partial<Omit<ProfileRow, "id">>;
        Update: Partial<Omit<ProfileRow, "id" | "created_at">>;
        Relationships: [];
      };
      diaries: {
        Row: DiaryRow;
        // user_id/text/art_style 필수, 나머지(id·avatar·status·*_at·deleted_at)는 DEFAULT/nullable → 선택
        Insert: Pick<DiaryRow, "user_id" | "text" | "art_style"> &
          Partial<Omit<DiaryRow, "user_id" | "text" | "art_style">>;
        Update: Partial<Omit<DiaryRow, "id" | "created_at">>;
        Relationships: [];
      };
      panels: {
        Row: PanelRow;
        Insert: Omit<PanelRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<PanelRow, "id" | "diary_id" | "created_at">>;
        Relationships: [];
      };
      generation_jobs: {
        Row: GenerationJobRow;
        // diary_id 필수, 나머지(id·stage·*_panels·error_code·*_at)는 DEFAULT/nullable → 선택
        Insert: Pick<GenerationJobRow, "diary_id"> &
          Partial<Omit<GenerationJobRow, "diary_id">>;
        Update: Partial<Omit<GenerationJobRow, "id" | "created_at">>;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        // user_id/tier/period 필수, 나머지(id·toss_billing_key·status·*_at·deleted_at)는 DEFAULT/nullable → 선택
        Insert: Pick<SubscriptionRow, "user_id" | "tier" | "period"> &
          Partial<Omit<SubscriptionRow, "user_id" | "tier" | "period">>;
        Update: Partial<Omit<SubscriptionRow, "id" | "created_at">>;
        Relationships: [];
      };
      credits_ledger: {
        Row: CreditsLedgerRow;
        Insert: Omit<CreditsLedgerRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        // 원장은 앱 레이어에서 불변 취급(RLS로 차단). 타입 정합을 위해 partial 유지.
        Update: Partial<Omit<CreditsLedgerRow, "id" | "created_at">>;
        Relationships: [];
      };
      quota_usage: {
        Row: QuotaUsageRow;
        Insert: Omit<QuotaUsageRow, "updated_at"> & { updated_at?: string };
        Update: Partial<Omit<QuotaUsageRow, "user_id" | "usage_date">>;
        Relationships: [];
      };
      share_cards: {
        Row: ShareCardRow;
        Insert: Omit<ShareCardRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ShareCardRow, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: {
      credits_balance: {
        Row: { user_id: string; balance: number };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
