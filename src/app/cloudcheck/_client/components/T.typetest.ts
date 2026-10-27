// src/app/cloudcheck/_client/components/T.typetest.ts — <T>의 키 타입 회귀(npm run type-check가 검사). 'ts-expect-error' 줄은 컴파일 오류가 나야 정상이다.
// JSX 대신 함수 호출로 쓴다(.ts) — 제네릭 컴포넌트의 K 추론이 JSX 속성과 같다.
import type { CatalogKey, DisplayValue } from "../../../../lib/cloudcheck/model/report";
import { T } from "./T";

declare const dataKey: CatalogKey;
declare const dv: DisplayValue;

export const ok1 = T({ k: "cc.status.risk" }); // 있는 C 키
export const ok2 = T({ k: dataKey }); // 데이터에서 온 키
export const ok3 = T({ k: "cc.rule.aws-mfa-1.title" }); // E 네임스페이스(존재는 registry·가드 테스트가 검사)
export const ok4 = T({ k: "cc.label.name-hint", p: { hint: "public", who: { v: dv } } }); // {v}는 T에서만 허용

// @ts-expect-error 카탈로그에 없는 C 키 리터럴(오타)
export const e1 = T({ k: "cc.c.does-not-exist" });
// @ts-expect-error 키가 아닌 문자열
export const e2 = T({ k: "just text" });
