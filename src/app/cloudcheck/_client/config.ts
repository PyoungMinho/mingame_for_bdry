// src/app/cloudcheck/_client/config.ts — 앱 설정(빌드 상수). 소유: 페이지개발자. 근거: 디자인 최종안 §6-0 config 행.
// 생성기(_build/generate.mjs)는 아래 PAGE_VERSION 선언을 정규식으로 읽는다 → 한 줄 `export const … = "숫자.숫자.숫자"` 형식을 지킨다(이 주석에는 같은 모양의 글자를 쓰지 않는다 — 첫 일치를 읽는다).
// 숫자·플래그는 카탈로그(i18n)에 쓰지 않고 여기서 파라미터로 넣는다(디자인 키 규칙 12). process.env·저장소를 쓰지 않는다(R-06).
import { AWS_CALLS, AZURE_CALLS } from "../../../lib/cloudcheck/contract/calls";
import type { Cloud, CliTemplate, ExternalLink } from "../../../lib/cloudcheck/model/report";

/** 페이지 버전. 오프라인판 파일 이름(cloudcheck-<버전>.html)과 바닥 줄이 쓴다 */
export const PAGE_VERSION = "0.1.0";

/**
 * 클라우드 공개 상태(V0·V1·V6의 Azure 분기를 모두 이 값이 제어한다 — PM 기본안 Q4).
 *  open = 정식 · beta = 베타(띠 표시) · soon = 실점검 준비 중(체험은 공개)
 */
export type CloudAvailability = "open" | "beta" | "soon";
export type Availability = Readonly<Record<Cloud, CloudAvailability>>;
/** 리터럴로 좁히지 않는다(분기가 죽은 코드로 보이지 않게). 테스트는 AppProvider의 availability로 바꿔 시험한다 */
export const CLOUD_AVAILABILITY: Availability = { aws: "beta", azure: "soon" };

/** 베타 띠를 보일지(`aws === "beta"`인 동안 — 디자인 §3-1 띠 선택 규칙) */
export const isBetaPhase = (a: Availability = CLOUD_AVAILABILITY): boolean => a.aws === "beta";
/** 실점검 시작이 가능한 클라우드인가(soon이 아니면 V1로 간다 — T2) */
export const canCollect = (cloud: Cloud, a: Availability = CLOUD_AVAILABILITY): boolean => a[cloud] !== "soon";

/**
 * 해시 게시 채널(디자인 Q1: 페이지 자신의 SHA-256은 파일 안에 적을 수 없다). null = '준비 중'(G9 전).
 *  repo = 저장소 릴리스 링크(LINK_HOSTS 안 호스트) · pdf = PDF 개정판 번호와 쪽
 */
export interface HashChannels {
  readonly repo: ExternalLink | null;
  readonly pdf: { readonly edition: string; readonly page: number } | null;
}
export const HASH_CHANNELS: HashChannels = { repo: null, pdf: null };

/** 푸터 저장소 링크(X13 ⟨잠정⟩ null → 링크 숨김, "만든 곳: Boundaryworks"만). PM 확인(G9) 뒤 채운다 */
export const REPO_URL: ExternalLink | null = null;

/** 수집기 옵션 글자(카탈로그에 넣지 않는다 — X8 ⟨잠정⟩ --print, 문을 나눠 실행하는 --doors) */
export const COLLECTOR_FLAGS = { print: "--print", doors: "--doors" } as const;

/**
 * 수집기 원문을 읽는 사람을 위한 한 줄 안내(V1 '예상 호출 목록' 아래, D4 통합 — 백엔드팀장 리뷰 문구 후보, 디자인 확인 ⟨잠정⟩).
 * token은 원문에 실제로 있는 글자이고, 화면은 원문에 token이 있을 때만 안내를 보인다(수집기가 바뀌면 안내가 저절로 빠져 낡지 않는다).
 * 명령·환경 변수 글자는 카탈로그에 넣지 않고 {code} 파라미터로 넣는다(키 규칙 12).
 *  aws: 설정된 엔드포인트 지정을 무시하는 환경 변수(프록시·인증서 설정은 그대로) / azure: 예상 호출 목록에 넣지 않은 로컬 버전 읽기
 */
export const SCRIPT_NOTES = {
  aws: { token: "AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true", key: "cc.prep.fp.endpoint-note.aws" },
  azure: { token: "az version", key: "cc.prep.fp.local-note.azure" },
} as const;

/** V4 계정 확인 줄의 읽기 명령(F2). 글자는 호출 카탈로그(contract/calls.ts)의 조회 호출 그대로다 */
export const ACCOUNT_CHECK: Readonly<Record<Cloud, CliTemplate<"read">>> = {
  aws: { kind: "read", shell: "aws", segments: [{ t: "text", v: AWS_CALLS["sts:GetCallerIdentity"].cli }] },
  azure: { kind: "read", shell: "az", segments: [{ t: "text", v: AZURE_CALLS["azure:account.show"].cli }] },
};

/** 한 번에 읽는 파일 상한(UX §13-2 가정). cc.input.too-many의 {max} */
export const MAX_FILES = 8;
/** 대상 표 쪽 단위(50개씩 더 보기) */
export const TABLE_PAGE = 50;
/** 직접 볼 목록 묶음 기준: 같은 점검·같은 사유 대상이 이 수 이상이면 한 행으로 묶는다(UX 5개 초과 = 6개 이상) */
export const MANUAL_GROUP_MIN = 6;
/** 예외 기본 만료(오늘부터 며칠 뒤). 허용 범위는 내일~EXCEPTION_MAX_DAYS */
export const EXC_DEFAULT_DAYS = 30;

/**
 * 수집기 원문의 구간 표식(X16). 수집기는 줄 맨 앞에 `# @cc:section <id> — <설명>`을 둔다(규약: lib/cloudcheck/collector/markers.ts).
 * id: common · prepare · identity · scope · mfa-key(AWS) · storage(Azure) · net · sto · log · assemble. ScriptViewer는 첫 캡처 그룹이 문 ID(mfa·key·net·sto·log)면 그 문의 구간,
 * 아니면 '신원·범위' 구간으로 보인다. 그래서 새 구간을 여는 표식은 문 구간(합쳐서 쓰는 `mfa-key`는 앞의 `mfa`로, Azure의 `storage`는 `sto`로 잡는다)과 맨 끝 조립(assemble)뿐이고,
 * 공용·준비·신원·범위(common·prepare·identity·scope)는 맨 앞의 한 '신원·범위' 구간으로 합쳐진다(표식이 다섯 번 나뉘어 보이지 않게).
 * 표식을 못 찾으면 ScriptViewer가 전체를 한 덩어리로 보인다. g 플래그를 쓰지 않는다(줄마다 exec해도 lastIndex 상태가 남지 않게).
 */
export const SCRIPT_SECTION_RE = /^#\s*@cc:section\s+((?:mfa(?=-key\b)|net\b|sto(?=rage\b|\b)|log\b)|assemble\b)/;
