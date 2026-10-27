// src/app/cloudcheck/_client/screens/constants.ts — 화면 상수(번역 대상이 아닌 데이터). 소유: 페이지개발자.
import type { Cloud, ExternalLink, GlobalCannotSee } from "../../../../lib/cloudcheck/model/report";

/** 이 도구가 보지 못하는 것 7가지(모델 GlobalCannotSee). 문장은 엔진 카탈로그 cc.gcs.<코드> */
export const ALL_CANNOT_SEE: readonly GlobalCannotSee[] = [
  "leaked-keys", "issued-sas-oauth", "other-accounts", "abandoned-test-envs", "app-vulnerabilities", "idp-mfa", "resource-policy-sharing",
];
/** V0 A8에 먼저 보이는 3개(나머지 4개는 '7가지 모두 보기') */
export const START_CANNOT_SEE: readonly GlobalCannotSee[] = ["leaked-keys", "idp-mfa", "app-vulnerabilities"];
export const MORE_CANNOT_SEE: readonly GlobalCannotSee[] = ALL_CANNOT_SEE.filter((c) => !START_CANNOT_SEE.includes(c));

/** ClickFix 설명 링크(기획서 §2 #7 [확인]). 호스트는 LINK_HOSTS 안 */
export const CLICKFIX_LINK: ExternalLink = {
  href: "https://www.helpnetsecurity.com/2025/06/26/clickfix-attacks-fakecaptcha-eset-report/",
  host: "www.helpnetsecurity.com",
};

/** 수집기 파일 이름 */
export const COLLECTOR_FILE: Readonly<Record<Cloud, string>> = { aws: "cloudcheck-aws.sh", azure: "cloudcheck-azure.sh" };
/**
 * 수집기 Blob 내려받기 MIME(프론트팀장, STEP 6 최종 리뷰 §2-3). text/plain이면 Safari가 이름 끝에 .txt를 덧붙일 수 있고
 * (cloudcheck-aws.sh.txt), 그러면 V1에서 직접 입력하라고 안내한 두 줄(sha256sum·bash + 파일 이름)이 그대로 실패한다.
 * application/octet-stream은 바이트·해시를 바꾸지 않고 이름만 지킨다. 다른 내려받기는 확장자와 MIME이 이미 맞다(.json = application/json, 오프라인판 .html = text/html + Content-Disposition).
 */
export const COLLECTOR_MIME = "application/octet-stream";
