// src/app/cloudcheck/_client/i18n/keys.typetest.ts — 키 타입·t() 규약의 컴파일 단계 회귀(npm run type-check가 검사). 소유: 프론트팀장.
// 아래 'ts-expect-error' 지시어가 붙은 줄은 컴파일 오류가 나야 정상이다. 오류가 사라지면 type-check가 실패한다(model/report.typetest.ts와 같은 방식).
import type { CatalogKey, DisplayValue } from "../../../../lib/cloudcheck/model/report";
import { t, type ComponentsCatalog, type ScreensCatalog } from "./index";

declare const dv: DisplayValue;
declare const dataKey: CatalogKey;
declare const free: string;
declare const okPart: "title" | "tagline";
declare const badPart: "title" | "nope";

// 통과해야 하는 것
export const ok1 = t("cc.start.title");                 // 있는 S 키
export const ok2 = t(dataKey);                          // 데이터에서 온 키(RuleCatalogEntry.titleKey 등)
export const ok3 = t("cc.rule.aws-mfa-1.title");        // E 네임스페이스(존재는 registry·가드 테스트가 검사)
export const ok4 = t(`cc.start.${okPart}`);             // 유한 유니온 — 모두 있으면 통과
export const ok5 = t("cc.start.title", { n: 3, at: "x" });
export const okC = { "cc.status.risk": "위험" } satisfies ComponentsCatalog;

// @ts-expect-error 카탈로그에 없는 S 키 리터럴(오타)
export const e1 = t("cc.start.nope");
// @ts-expect-error 어느 파일의 네임스페이스도 아닌 키
export const e2 = t("cc.zzz.anything");
// @ts-expect-error 키가 아닌 문자열
export const e3 = t(free);
// @ts-expect-error 유니온 중 하나라도 카탈로그에 없으면 오류
export const e4 = t(`cc.start.${badPart}`);
// @ts-expect-error 아무 문자열로 만든 C·S 네임스페이스 키(동적 C·S 키 금지)
export const e5 = t(`cc.c.${free}`);
// @ts-expect-error t()는 DisplayValue를 받지 않는다(사용자 데이터는 <T>·<Msg> → MaskedValue)
export const e6 = t("cc.start.title", { name: dv });
// @ts-expect-error t()는 MsgParam {v}도 받지 않는다
export const e7 = t("cc.start.title", { name: { v: dv } });
// @ts-expect-error C 카탈로그에 S 네임스페이스 키
export const e8 = { "cc.start.title": "x" } satisfies ComponentsCatalog;
// @ts-expect-error S 카탈로그에 C 네임스페이스 키
export const e9 = { "cc.status.risk": "x" } satisfies ScreensCatalog;
