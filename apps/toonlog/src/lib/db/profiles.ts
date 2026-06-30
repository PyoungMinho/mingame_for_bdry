/**
 * profiles 쿼리 헬퍼
 * auth.users 1:1 확장 테이블.
 * 신규 유저 생성 시 DB 트리거(toonlog_handle_new_user)가 기본 행을 자동 생성.
 */

import type { ArtStyleKey, AvatarConfig, Tier } from "../contract";
import { supabaseServer } from "./client";
import type { ProfileRow } from "./types";

export interface ProfileUpdateInput {
  tier?: Tier;
  avatar?: AvatarConfig;
  defaultArtStyle?: ArtStyleKey;
  theme?: "system" | "light" | "dark";
  betaEarlybird?: boolean;
}

// ──────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────

/**
 * 프로필 조회. 없으면 null (신규 유저 트리거 미실행 시 예외 케이스).
 */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const db = supabaseServer();
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return data as ProfileRow;
}

/**
 * 프로필 생성 또는 갱신 (upsert).
 * 신규 유저: auth.users INSERT 트리거가 먼저 기본 행을 만들므로
 *           여기서는 온보딩 완료 시 아바타/화풍 갱신 용도.
 * 기존 유저: 마이페이지 설정 변경.
 */
export async function upsertProfile(
  userId: string,
  input: ProfileUpdateInput
): Promise<ProfileRow> {
  const db = supabaseServer();

  const updateData: Record<string, unknown> = {};
  if (input.tier !== undefined) updateData.tier = input.tier;
  if (input.avatar !== undefined) updateData.avatar = input.avatar;
  if (input.defaultArtStyle !== undefined) updateData.default_art_style = input.defaultArtStyle;
  if (input.theme !== undefined) updateData.theme = input.theme;
  if (input.betaEarlybird !== undefined) updateData.beta_earlybird = input.betaEarlybird;

  const { data, error } = await db
    .from("profiles")
    .upsert({ id: userId, ...updateData }, { onConflict: "id" })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`upsertProfile failed: ${error?.message ?? "unknown"}`);
  }
  return data as ProfileRow;
}

/**
 * 마지막 사용 화풍/아바타 기억 (플로우 C 재방문 UX — design-final 플로우C).
 * 일기 생성 완료 후 비동기 호출.
 */
export async function rememberLastSettings(
  userId: string,
  artStyle: ArtStyleKey,
  avatar: AvatarConfig
): Promise<void> {
  const db = supabaseServer();
  await db
    .from("profiles")
    .update({ default_art_style: artStyle, avatar })
    .eq("id", userId);
}
