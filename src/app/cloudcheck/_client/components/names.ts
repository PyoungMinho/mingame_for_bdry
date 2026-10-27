// src/app/cloudcheck/_client/components/names.ts — 번역 대상이 아닌 이름 상수(클라우드 제품 이름). 한글이 아니므로 카탈로그 밖에 둔다.
import type { Cloud } from "../../../../lib/cloudcheck/model/report";

export const CLOUD_NAME: Readonly<Record<Cloud, string>> = { aws: "AWS", azure: "Azure" };
