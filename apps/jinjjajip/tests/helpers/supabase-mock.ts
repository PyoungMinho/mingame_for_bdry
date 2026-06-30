/**
 * 체이너블 Supabase 모킹 빌더 — API Route 핸들러 단위 테스트용.
 *
 * 지원 패턴:
 *   from(table).select(...).eq(...).is(...).maybeSingle()  → { data, error }
 *   from(table).select(...).single()                        → { data, error }
 *   from(table).insert(...).select(...).single()            → { data, error }
 *   from(table).insert(...)                                 → await 시 { data, error } (thenable)
 *   from(table).update(...).eq(...)                         → await 시 { data, error }
 *   storage.from(bucket).upload(path, file, opts)           → { data, error }
 *
 * 사용:
 *   const sb = makeSupabaseMock({
 *     listings: { selectResult: { data: { id: "L1", status: "verified" }, error: null } },
 *     profiles: { selectResult: { data: { role: "tenant", identity_verified: true }, error: null } },
 *     uploads:  { insertSelectSingle: { data: { id: "up1" }, error: null } },
 *   });
 *   vi.mocked(createServerClient).mockReturnValue(sb.client);
 */
import { vi, type Mock } from "vitest";

export interface TableResult {
  /** select(...).eq()...maybeSingle()/single() 또는 update().eq() await 결과 */
  selectResult?: { data: unknown; error: unknown };
  /** insert(...).select(...).single() 결과 (selectResult 와 분리) */
  insertSelectSingle?: { data: unknown; error: unknown };
  /** insert(...) await 결과(체인 없이) */
  insertResult?: { data: unknown; error: unknown };
  /** update(...).eq() await 결과 */
  updateResult?: { data: unknown; error: unknown };
}

export interface SupabaseMockConfig {
  [table: string]: TableResult;
}

export interface SupabaseMockHandle {
  client: { from: Mock; storage: { from: Mock } };
  storageUpload: Mock;
  inserts: Record<string, unknown[]>;
  updates: Record<string, unknown[]>;
}

export function makeSupabaseMock(config: SupabaseMockConfig = {}): SupabaseMockHandle {
  const inserts: Record<string, unknown[]> = {};
  const updates: Record<string, unknown[]> = {};
  const storageUpload = vi.fn(async () => ({ data: { path: "ok" }, error: null }));

  function makeQuery(table: string) {
    const cfg = config[table] ?? {};
    // 기본 await 결과(체인 끝에 select/update 가 await 되는 경우)
    let pendingResult: { data: unknown; error: unknown } = cfg.selectResult ?? {
      data: null,
      error: null,
    };
    let mode: "select" | "insert" | "update" = "select";

    const builder: Record<string, unknown> = {
      select: vi.fn(() => {
        if (mode === "insert") {
          // insert(...).select(...).single() 경로 준비
          pendingResult = cfg.insertSelectSingle ?? { data: null, error: null };
        } else {
          pendingResult = cfg.selectResult ?? { data: null, error: null };
        }
        return builder;
      }),
      insert: vi.fn((payload: unknown) => {
        mode = "insert";
        (inserts[table] ??= []).push(payload);
        // 기본 insert await 결과
        pendingResult = cfg.insertResult ?? { data: null, error: null };
        return builder;
      }),
      update: vi.fn((payload: unknown) => {
        mode = "update";
        (updates[table] ??= []).push(payload);
        pendingResult = cfg.updateResult ?? { data: null, error: null };
        return builder;
      }),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      not: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => pendingResult),
      single: vi.fn(async () => pendingResult),
      // 체인 끝에서 직접 await (insert/update 등)
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(pendingResult).then(resolve),
    };
    return builder;
  }

  const client = {
    from: vi.fn((table: string) => makeQuery(table)),
    storage: {
      from: vi.fn(() => ({ upload: storageUpload })),
    },
  };

  return { client, storageUpload, inserts, updates };
}
