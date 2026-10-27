// src/lib/cloudcheck/parse/schemas.ts — 수집 계약 스키마의 섹션 단위 사용 (방향서 §4-5 ⑦ makeSchemas('strict' | 'strip'))
// contract/collect-schema.ts(G0 동결)는 파일 전체의 strict 스키마만 내보낸다. 파서는 같은 스키마를 .shape로 쪼개 쓴다(원천은 하나):
//  - 봉투(schema, collector, collectedAt, run, cloud, identity, scope, receipts)는 한 번에 검증하고, 실패하면 파일 전체를 거부한다.
//  - data 섹션은 섹션마다 따로 safeParse한다. 실패한 섹션의 문만 확인 불가로 둔다.
//  - minor가 같거나 낮으면 strict(받아들이는 모양은 계약과 같다), 높으면 strip(알려진 필드만 쓰고 모르는 키는 버린다).
import { z } from "zod";
import { AwsCollectFile, AzureCollectFile } from "../contract/collect-schema";

export type SchemaMode = "strict" | "strip";
export interface CloudSchemas {
  /** data를 느슨한 레코드로 바꾼 봉투 전체 */
  readonly envelope: z.ZodTypeAny;
  /** data 섹션 이름 → 섹션 스키마 */
  readonly sections: ReadonlyMap<string, z.ZodTypeAny>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** strict 객체를 strip으로 바꾼다(중첩·배열·nullable·optional·refine 포함). 문자열·숫자·열거 등 잎은 그대로 둔다 */
export function toStrip(s: z.ZodTypeAny): z.ZodTypeAny {
  const def = s._def as any;
  switch (def.typeName) {
    case "ZodObject": {
      const mapped: Record<string, z.ZodTypeAny> = {};
      for (const [k, v] of Object.entries((s as z.AnyZodObject).shape)) mapped[k] = toStrip(v as z.ZodTypeAny);
      return (s as z.AnyZodObject).extend(mapped).strip();
    }
    case "ZodArray": return new z.ZodArray({ ...def, type: toStrip(def.type) });
    case "ZodOptional": return toStrip(def.innerType).optional();
    case "ZodNullable": return toStrip(def.innerType).nullable();
    case "ZodEffects": return new z.ZodEffects({ ...def, schema: toStrip(def.schema) });
    case "ZodUnion": return z.union(def.options.map((o: z.ZodTypeAny) => toStrip(o)));
    default: return s;
  }
}

const cache = new Map<string, CloudSchemas>();
export function makeSchemas(cloud: "aws" | "azure", mode: SchemaMode): CloudSchemas {
  const key = `${cloud}|${mode}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const file = cloud === "aws" ? AwsCollectFile : AzureCollectFile;
  const shape = file.shape as Record<string, z.ZodTypeAny>;
  const adapt = (s: z.ZodTypeAny): z.ZodTypeAny => (mode === "strip" ? toStrip(s) : s);
  const env: Record<string, z.ZodTypeAny> = {};
  for (const k of ["schema", "collector", "collectedAt", "run", "cloud", "identity", "scope", "receipts"]) env[k] = adapt(shape[k]);
  env.data = z.record(z.string(), z.unknown());
  const envelope = mode === "strict" ? z.object(env).strict() : z.object(env).strip();
  const dataShape = (shape.data as z.AnyZodObject).shape as Record<string, z.ZodTypeAny>;
  const sections = new Map<string, z.ZodTypeAny>();
  for (const [k, v] of Object.entries(dataShape)) sections.set(k, adapt((v as z.ZodOptional<z.ZodTypeAny>).unwrap()));
  const out: CloudSchemas = { envelope, sections };
  cache.set(key, out);
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
