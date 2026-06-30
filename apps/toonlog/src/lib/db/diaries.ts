/**
 * diaries + panels 쿼리 헬퍼
 * API설계자가 import 해서 사용하는 공개 인터페이스.
 *
 * 암호화 정책:
 *   - createDiary(): text는 저장 전 encryptText()를 통해 암호화
 *   - getDiary() / listDiaries(): 조회 후 decryptText()로 복호화
 *   - 암호화 키: 환경변수 DIARY_ENCRYPTION_KEY (AES-256-GCM)
 *   - 키 미설정 시 평문 저장 (개발 환경 폴백, 경고 로그)
 */

import type { Diary, Panel, BalloonMeta, CreateDiaryRequest, DiaryStatus, PanelIndex } from "../contract";
import { supabaseServer } from "./client";
import type { DiaryRow, PanelRow } from "./types";

// ──────────────────────────────────────────
// 암호화 헬퍼 (앱 레이어)
// ──────────────────────────────────────────

const ENC_KEY = process.env.DIARY_ENCRYPTION_KEY ?? "";
const ALGO = "AES-GCM";

async function encryptText(plain: string): Promise<string> {
  if (!ENC_KEY) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[toonlog] DIARY_ENCRYPTION_KEY not set — storing diary text as plaintext");
    }
    return plain;
  }
  const key = await importKey(ENC_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    new TextEncoder().encode(plain)
  );
  // iv(12) + ciphertext → base64
  const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.byteLength);
  return Buffer.from(combined).toString("base64");
}

async function decryptText(cipher: string): Promise<string> {
  if (!ENC_KEY) return cipher;
  try {
    const key = await importKey(ENC_KEY);
    const buf = Buffer.from(cipher, "base64");
    const iv = buf.subarray(0, 12);
    const data = buf.subarray(12);
    const plain = await crypto.subtle.decrypt({ name: ALGO, iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch {
    // 복호화 실패 시 암호문 그대로 반환 (마이그레이션 중간 상태 등)
    console.error("[toonlog] diary decrypt failed — returning raw text");
    return cipher;
  }
}

async function importKey(rawKey: string): Promise<CryptoKey> {
  const keyBuf = Buffer.from(rawKey.padEnd(32, "0").slice(0, 32), "utf-8");
  return crypto.subtle.importKey("raw", keyBuf, ALGO, false, ["encrypt", "decrypt"]);
}

// ──────────────────────────────────────────
// Row → Domain 변환
// ──────────────────────────────────────────

function rowToDiary(row: DiaryRow, panels: PanelRow[] = []): Diary {
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text, // 이미 복호화된 값
    artStyle: row.art_style,
    avatar: row.avatar,
    status: row.status,
    panels: panels
      .sort((a, b) => a.panel_index - b.panel_index)
      .map(rowToPanel),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPanel(row: PanelRow): Panel {
  return {
    index: row.panel_index,
    imageUrl: row.image_url ?? "",
    previewUrl: row.preview_url ?? undefined,
    caption: row.caption ?? undefined,
    balloons: Array.isArray(row.balloons) ? row.balloons : [],
  };
}

// ──────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────

/**
 * 새 일기 생성. status='queued' 로 시작.
 * 반환된 Diary.id 로 createJob() 을 이어서 호출해야 생성이 시작된다.
 */
export async function createDiary(
  userId: string,
  input: CreateDiaryRequest
): Promise<Diary> {
  const db = supabaseServer();
  const encryptedText = await encryptText(input.text);

  const { data, error } = await db
    .from("diaries")
    .insert({
      user_id: userId,
      text: encryptedText,
      art_style: input.artStyle,
      avatar: input.avatar,
      status: "queued",
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`createDiary failed: ${error?.message ?? "unknown"}`);
  }

  const decryptedText = await decryptText(data.text);
  return rowToDiary({ ...data, text: decryptedText }, []);
}

/**
 * 단건 일기 조회 (패널 포함). 존재하지 않으면 null.
 * id: diary UUID
 */
export async function getDiary(id: string): Promise<Diary | null> {
  const db = supabaseServer();

  const [diaryRes, panelsRes] = await Promise.all([
    db.from("diaries").select("*").eq("id", id).is("deleted_at", null).single(),
    db.from("panels").select("*").eq("diary_id", id).order("panel_index"),
  ]);

  if (diaryRes.error || !diaryRes.data) return null;

  const decryptedText = await decryptText(diaryRes.data.text);
  return rowToDiary(
    { ...diaryRes.data, text: decryptedText },
    (panelsRes.data ?? []) as PanelRow[]
  );
}

export interface ListDiariesOptions {
  /** 페이지 오프셋 */
  offset?: number;
  /** 최대 반환 수 (기본 30) */
  limit?: number;
  /** 특정 월 필터 (YYYY-MM) — 캘린더 아카이브용 */
  month?: string;
  status?: DiaryStatus;
}

/**
 * 유저 일기 목록 조회. 패널은 포함하지 않는다(썸네일은 별도 호출).
 * 아카이브 캘린더: month 파라미터로 월별 필터링.
 */
export async function listDiaries(
  userId: string,
  opts: ListDiariesOptions = {}
): Promise<Diary[]> {
  const db = supabaseServer();
  const { offset = 0, limit = 30, month, status } = opts;

  let query = db
    .from("diaries")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (month) {
    // YYYY-MM 기준 월 필터
    const from = `${month}-01T00:00:00.000Z`;
    const nextMonth = new Date(`${month}-01`);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const to = nextMonth.toISOString();
    query = query.gte("created_at", from).lt("created_at", to);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listDiaries failed: ${error.message}`);

  const rows = (data ?? []) as DiaryRow[];
  const diaries = await Promise.all(
    rows.map(async (row) => {
      const decryptedText = await decryptText(row.text);
      return rowToDiary({ ...row, text: decryptedText }, []);
    })
  );
  return diaries;
}

/**
 * 일기 status 갱신. 생성 파이프라인 단계별 호출.
 */
export async function updateDiaryStatus(
  id: string,
  status: DiaryStatus
): Promise<void> {
  const db = supabaseServer();
  const { error } = await db
    .from("diaries")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(`updateDiaryStatus failed: ${error.message}`);
}

/**
 * 패널 저장 (upsert). 1컷씩 SSE 완성 시 호출.
 * Panel.index 기준 UNIQUE 제약으로 중복 방지.
 */
export async function savePanels(
  diaryId: string,
  panels: Panel[]
): Promise<void> {
  const db = supabaseServer();

  const rows = panels.map((p) => ({
    diary_id: diaryId,
    panel_index: p.index,
    image_url: p.imageUrl,
    preview_url: p.previewUrl ?? null,
    caption: p.caption ?? null,
    balloons: p.balloons,
  }));

  const { error } = await db
    .from("panels")
    .upsert(rows, { onConflict: "diary_id,panel_index" });

  if (error) throw new Error(`savePanels failed: ${error.message}`);
}

/**
 * 컷별 말풍선 메타 갱신 (말풍선 에디터 저장).
 * 이미지/캡션은 건드리지 않고 balloons jsonb 만 갱신한다.
 * PanelIndex 별로 개별 update (panels UNIQUE(diary_id, panel_index)).
 */
export async function updatePanelBalloons(
  diaryId: string,
  updates: { index: PanelIndex; balloons: BalloonMeta[] }[]
): Promise<void> {
  const db = supabaseServer();

  for (const u of updates) {
    const { error } = await db
      .from("panels")
      .update({ balloons: u.balloons })
      .eq("diary_id", diaryId)
      .eq("panel_index", u.index);

    if (error) {
      throw new Error(`updatePanelBalloons failed (panel ${u.index}): ${error.message}`);
    }
  }
}

/**
 * 소프트 삭제. 하드 삭제는 service role 직접 쿼리만 가능.
 */
export async function softDeleteDiary(id: string): Promise<void> {
  const db = supabaseServer();
  const { error } = await db
    .from("diaries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`softDeleteDiary failed: ${error.message}`);
}
