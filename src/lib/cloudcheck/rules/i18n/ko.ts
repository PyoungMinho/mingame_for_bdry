// src/lib/cloudcheck/rules/i18n/ko.ts — E 카탈로그(엔진·룰 문구) 합본. 소유: DB설계자.
// 프론트 병합: _client/i18n/index.ts의 CATALOG에 `...ENGINE_KO` 한 줄을 더하고 FILES.engine을 ENGINE_KO로 바꾼다.
//   (EngineCatalog = Readonly<Partial<Record<`cc.${reason|banner|time|recog|fact|gcs|rule|ph|basis|incident}.${string}`, string>>> 와 구조가 맞다.)
// 구성: ko.common.ts(엔진 공통 문장·알림·시간·인식·분포 밖 안내·자리표시자) + ko.aws.ts(AWS 룰 10장) + ko.azure.ts(Azure 룰 8장).
// 같은 키가 두 파일에 있으면 뒤 파일이 앞을 덮어쓰므로, 키 중복은 registry 테스트가 막는다.
import { KO_AWS } from "./ko.aws";
import { KO_AZURE } from "./ko.azure";
import { KO_COMMON } from "./ko.common";

export const ENGINE_KO = { ...KO_COMMON, ...KO_AWS, ...KO_AZURE } as const;

export type EngineKoKey = keyof typeof ENGINE_KO;

/** 파일별 원본(중복·소속 검사용) */
export const ENGINE_KO_PARTS = { common: KO_COMMON, aws: KO_AWS, azure: KO_AZURE } as const;
