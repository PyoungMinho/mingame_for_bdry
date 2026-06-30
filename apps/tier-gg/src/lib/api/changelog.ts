/**
 * Repository — 변경 이력 조회
 */
import { isMockMode, supabaseAdmin } from "@/lib/supabase/server";
import type { ChangelogEntry } from "@/lib/types/model";
import { getMockChangelogAdapted } from "./mock-adapter";

type ChangelogRow = {
  id: string;
  entity_id: string | null;
  field: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
  changed_by: string | null;
  entities: { name: string; slug: string } | null;
};

/**
 * 최근 변경 이력 목록
 */
export async function recentChangelog(limit = 20): Promise<ChangelogEntry[]> {
  if (isMockMode()) {
    return getMockChangelogAdapted()
      .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
      .slice(0, limit);
  }

  const { data, error } = await supabaseAdmin
    .from("changelog")
    .select(
      `
      id, entity_id, field, old_value, new_value, changed_at, changed_by,
      entities ( name, slug )
    `
    )
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as ChangelogRow[];

  return rows.map((row) => ({
    id: row.id,
    entity_id: row.entity_id,
    field: row.field,
    old_value: row.old_value,
    new_value: row.new_value,
    changed_at: row.changed_at,
    changed_by: row.changed_by,
    entity_name: row.entities?.name,
    entity_slug: row.entities?.slug,
  }));
}
