// micro 픽스처 정답표 — 룰 명세(docs/planning/cloudcheck-plan.md §6, 각 룰 파일 머리 주석)를 읽고 사람이 먼저 쓴 기대값이다.
// 엔진 출력에서 복사하지 않는다. 틀리면 엔진 또는 픽스처가 명세와 다르다는 뜻이므로 기대값이 아니라 엔진/픽스처를 고친다(스냅샷 갱신 경로 없음).
// 형식: "micro/<룰>/<이름>": [룰 상태, 대상별 사유 slug(상태순·MatchKey순 정렬 결과를 이름순으로 비교하려고 정렬해서 적는다)]
import { describe, expect, it } from "vitest";
import type { RuleId, Status } from "../model/report";
import { checkInvariants } from "../fixtures/invariants";
import { checkReport } from "../fixtures/report-invariants";
import { MICRO, resolveFixture } from "../fixtures/micro";
import { judge } from "../engine/judge";

type Row = readonly [Status, readonly string[]];
const T: Readonly<Record<string, Row>> = {
  // 창고
  "micro/AWS-STO-2/pass": ["clear", ["block-all-on", "not-public"]],
  "micro/AWS-STO-2/public-policy": ["risk", ["block-all-on", "bucket-public-policy"]],
  "micro/AWS-STO-2/public-acl": ["risk", ["bucket-public-acl"]],
  "micro/AWS-STO-2/website-public": ["caution", ["website-public"]],
  "micro/AWS-STO-2/block-off": ["caution", ["public-possible"]],
  "micro/AWS-STO-2/policy-restricted": ["clear", ["not-public"]],
  "micro/AWS-STO-2/empty": ["na", []],
  "micro/AWS-STO-2/acl-enabled": ["caution", ["acl-enabled"]],
  "micro/AWS-STO-2/acl-enabled-preferred": ["caution", ["acl-enabled"]],
  "micro/AWS-STO-2/acl-enabled-unset": ["caution", ["acl-enabled"]],
  "micro/AWS-STO-2/acl-enabled-other": ["caution", ["acl-enabled"]],
  "micro/AZ-STO-2/pass": ["clear", ["container-private", "container-private"]],
  "micro/AZ-STO-2/public-container": ["risk", ["container-private", "container-public"]],
  "micro/AZ-STO-2/web-container": ["caution", ["web-container"]],
  "micro/AZ-STO-2/account-blocks": ["clear", ["account-blocks"]],
  "micro/AZ-STO-2/no-containers": ["na", []],
  "micro/AZ-STO-2/empty": ["na", []],
  "micro/AZ-STO-2/access-unreadable": ["unknown", ["value-unrecognized"]],
  "micro/AWS-STO-1/pass": ["clear", ["all-blocked"]],
  "micro/AWS-STO-1/partial": ["caution", ["block-partial"]],
  "micro/AWS-STO-1/no-config": ["caution", ["no-config"]],
  "micro/AZ-STO-1/pass": ["clear", ["allow-false", "allow-false"]],
  "micro/AZ-STO-1/allow-true": ["caution", ["allow-false", "allow-true"]],
  "micro/AZ-STO-1/allow-unset": ["caution", ["allow-unset"]],
  "micro/AZ-STO-1/empty": ["na", []],
  // 창문
  "micro/AWS-NET-1/pass": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/public-ssh": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/unattached": ["caution", ["sg-unattached"]],
  "micro/AWS-NET-1/private-only": ["caution", ["sg-private"]],
  "micro/AWS-NET-1/other-port": ["caution", ["sg-other"]],
  "micro/AWS-NET-1/mail-port": ["caution", ["sg-mail"]],
  "micro/AWS-NET-1/all-traffic": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/other-region": ["risk", ["sg-closed", "sg-public"]],
  "micro/AWS-NET-1/ipv6-only": ["caution", ["sg-private"]],
  "micro/AWS-NET-1/no-rules": ["clear", ["sg-closed"]],
  // 보안 그룹 0개(활성 리전을 모두 조회) = 해당 없음. 주의 범주 셋(연결 없음 · 그 밖의 포트 · 메일)이 섞이면 대상은 셋 모두 주의
  "micro/AWS-NET-1/empty": ["na", []],
  "micro/AWS-NET-1/mixed-caution": ["caution", ["sg-mail", "sg-other", "sg-unattached"]],
  "micro/AZ-NET-1/pass": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/public-rdp": ["risk", ["nsg-public"]],
  "micro/AZ-NET-1/unattached": ["caution", ["nsg-unattached"]],
  "micro/AZ-NET-1/private-only": ["caution", ["nsg-private"]],
  "micro/AZ-NET-1/denied-first": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/via-subnet": ["risk", ["nsg-public"]],
  "micro/AZ-NET-1/port-range": ["caution", ["nsg-unattached"]],
  "micro/AZ-NET-1/mail-port": ["caution", ["nsg-mail"]],
  "micro/AZ-NET-1/csv-attachment-unknown": ["caution", ["nsg-attachment-unknown"]],
  "micro/AZ-NET-1/csv-no-risk": ["unknown", ["csv-scope-unproven"]],
  "micro/AZ-NET-1/empty": ["na", []],
  "micro/AZ-NET-1/mixed-caution": ["caution", ["nsg-mail", "nsg-other", "nsg-unattached"]],
  // 열쇠
  "micro/AWS-KEY-4/pass": ["clear", ["trust-ok", "trust-ok", "trust-ok"]],
  "micro/AWS-KEY-4/wildcard": ["risk", ["trust-ok", "trust-wildcard-open"]],
  "micro/AWS-KEY-4/wildcard-conditioned": ["caution", ["trust-wildcard-org-condition"]],
  "micro/AWS-KEY-4/external-no-external-id": ["caution", ["trust-external-no-external-id", "trust-ok"]],
  "micro/AWS-KEY-4/external-org-condition": ["caution", ["trust-external-org-condition"]],
  "micro/AWS-KEY-4/only-service-linked": ["na", []],
  "micro/AWS-KEY-4/empty": ["na", []],
  "micro/AWS-KEY-4/deny-and-other-actions": ["clear", ["trust-ok"]],
  "micro/AWS-KEY-4/external-session-principal": ["caution", ["trust-external-no-external-id"]],
  "micro/AWS-KEY-4/account-number-principal": ["caution", ["trust-external-no-external-id"]],
  "micro/AWS-KEY-4/self-session-principal": ["clear", ["trust-ok"]],
  "micro/AWS-KEY-4/wildcard-action": ["risk", ["trust-wildcard-open"]],
  // S3 정식 사용자 ID를 믿음: ExternalId 조건 없는 외부 주체와 같은 주의(모든 주체(*)가 아니다)
  "micro/AWS-KEY-4/canonical-user": ["caution", ["trust-external-no-external-id"]],
  "micro/AWS-KEY-3/pass": ["na", []],
  "micro/AWS-KEY-3/admin-key": ["caution", ["admin-active-key"]],
  "micro/AWS-KEY-3/admin-via-group": ["caution", ["admin-active-key"]],
  "micro/AWS-KEY-3/admin-no-key": ["na", []],
  "micro/AWS-KEY-1/pass": ["clear", ["key-recent", "key-recent", "key-recent"]],
  "micro/AWS-KEY-1/old-key": ["caution", ["key-recent", "key-too-old"]],
  "micro/AWS-KEY-1/no-active-keys": ["na", []],
  "micro/AWS-KEY-2/pass": ["clear", ["credentials-used", "credentials-used"]],
  "micro/AWS-KEY-2/unused-key": ["caution", ["credential-unused", "credentials-used"]],
  "micro/AWS-KEY-2/never-used-key": ["caution", ["credential-unused", "credentials-used"]],
  // 보고서(CSV)만으로 읽은 키(끝 4자리 없음, 슬롯 번호만): 판정은 수집기 경로와 같다
  "micro/AWS-KEY-2/unused-key-report-only": ["caution", ["credential-unused", "credentials-used"]],
  "micro/AWS-KEY-2/never-used-key-report-only": ["caution", ["credential-unused", "credentials-used"]],
  "micro/AWS-KEY-2/grace-key": ["clear", ["credentials-used", "credentials-used"]],
  "micro/AWS-KEY-2/unused-console": ["caution", ["credential-unused", "credentials-used"]],
  "micro/AWS-KEY-2/no-active": ["na", []],
  "micro/AZ-KEY-1/pass": ["clear", ["keys-rotated", "shared-key-off"]],
  "micro/AZ-KEY-1/old-key": ["caution", ["key-not-rotated"]],
  "micro/AZ-KEY-1/no-record": ["caution", ["key-no-record"]],
  "micro/AZ-KEY-1/empty": ["na", []],
  // 현관
  "micro/AWS-MFA-1/pass": ["clear", ["root-secured"]],
  "micro/AWS-MFA-1/root-key": ["risk", ["root-key-active"]],
  "micro/AWS-MFA-1/no-mfa": ["risk", ["root-no-mfa"]],
  "micro/AWS-MFA-1/recent-login": ["caution", ["root-recent-login"]],
  "micro/AWS-MFA-1/no-credentials": ["na", []],
  "micro/AWS-MFA-1/conflict": ["unknown", ["stale-evidence"]],
  "micro/AWS-MFA-1/no-summary": ["clear", ["root-secured"]],
  "micro/AWS-MFA-1/not-supported": ["clear", ["root-secured"]],
  "micro/AWS-MFA-1/not-supported-none": ["clear", ["root-secured"]],
  "micro/AWS-MFA-1/not-supported-no-mfa": ["risk", ["root-no-mfa"]],
  // 루트 키 개수의 권위는 계정 요약(contract/NORMALIZED.md §6). 보고서의 루트 키 목록이 partial이어도 요약이 있고 같은 말을 하면 완전한 것으로 본다
  "micro/AWS-MFA-1/partial-keys-summary-zero": ["clear", ["root-secured"]],
  "micro/AWS-MFA-1/partial-keys-no-summary": ["unknown", ["field-missing"]],
  "micro/AWS-MFA-1/partial-keys-summary-disagrees": ["unknown", ["stale-evidence"]],
  "micro/AWS-MFA-1/partial-keys-active": ["risk", ["root-key-active"]],
  "micro/AWS-MFA-1/partial-keys-active-no-summary": ["risk", ["root-key-active"]],
  "micro/AWS-MFA-1/partial-keys-no-mfa-no-summary": ["risk", ["root-no-mfa"]],
  "micro/AWS-MFA-2/pass": ["clear", ["user-has-mfa"]],
  "micro/AWS-MFA-2/no-mfa": ["risk", ["user-has-mfa", "user-no-mfa"]],
  "micro/AWS-MFA-2/no-console-users": ["na", []],
  "micro/AWS-MFA-2/empty": ["na", []],
  // CCTV
  "micro/AWS-LOG-1/pass": ["clear", ["trail-ok"]],
  "micro/AWS-LOG-1/no-trail": ["caution", ["no-trail"]],
  "micro/AWS-LOG-1/stopped": ["caution", ["trail-not-logging"]],
  "micro/AWS-LOG-1/single-region": ["caution", ["trail-single-region"]],
  "micro/AWS-LOG-1/no-validation": ["caution", ["trail-no-validation"]],
  "micro/AWS-LOG-1/read-only": ["caution", ["trail-no-write-events"]],
  "micro/AWS-LOG-1/one-good": ["clear", ["trail-ok"]],
  "micro/AZ-LOG-1/pass": ["clear", ["exported"]],
  "micro/AZ-LOG-1/no-export": ["caution", ["no-export"]],
  "micro/AZ-LOG-1/categories-missing": ["caution", ["categories-missing"]],
  "micro/AZ-LOG-1/event-hub-only": ["caution", ["destination-not-retained"]],
  "micro/AZ-LOG-1/all-logs-group": ["clear", ["exported"]],
  "micro/AZ-LOG-1/audit-group-only": ["unknown", ["value-unrecognized"]],
  "micro/AZ-LOG-1/empty": ["na", []],
  "micro/AZ-LOG-1/both-destinations": ["clear", ["exported"]],
  "micro/AZ-LOG-2/pass": ["clear", ["blob-logged"]],
  "micro/AZ-LOG-2/no-diagnostics": ["caution", ["no-diagnostics"]],
  "micro/AZ-LOG-2/categories-missing": ["caution", ["categories-missing"]],
  "micro/AZ-LOG-2/audit-group": ["unknown", ["value-unrecognized"]],
  "micro/AZ-LOG-2/disabled-category": ["caution", ["categories-missing"]],
  "micro/AZ-LOG-2/empty": ["na", []],

  /* ═════════ STEP 5 QA 수정 1라운드: 모르는 값 · 시각 역전 · 목록 잘림 경계 사례 (룰 명세 + P3를 읽고 먼저 쓴 기대값) ═════════ */
  // CC-QA-01 · 기준 시각이 증거보다 이르다(보고서 02:00, 수집 03:00). CSV 칸은 5분, 실시간 호출은 보고서 캐시(4시간 5분)까지 늦을 수 있다. 오래됐다는 결론(주의)은 그대로 둔다
  "micro/AWS-KEY-1/clock-skew-csv": ["unknown", ["stale-evidence"]],
  "micro/AWS-KEY-1/clock-skew-within-tolerance": ["clear", ["key-recent"]],
  // parse가 알려 준 입력 안 가장 늦은 증거 시각(latestEvidence)이 기준 시각보다 늦다: 룰이 직접 읽는 칸에는 역전이 없어도 기준 시각이 틀린 것이다(허용치 5분)
  "micro/AWS-KEY-1/latest-evidence-later": ["unknown", ["stale-evidence"]],
  "micro/AWS-KEY-1/latest-evidence-within-tolerance": ["clear", ["key-recent"]],
  "micro/AWS-KEY-1/created-after-report-csv": ["unknown", ["stale-evidence"]],
  "micro/AWS-KEY-1/created-after-report-live": ["clear", ["key-recent"]],
  "micro/AWS-KEY-1/created-long-after-report-live": ["unknown", ["stale-evidence"]],
  "micro/AWS-KEY-2/used-after-report-csv": ["unknown", ["stale-evidence"]],
  "micro/AWS-KEY-2/latest-evidence-later": ["unknown", ["stale-evidence"]],
  "micro/AWS-KEY-2/never-used-created-after-report": ["unknown", ["stale-evidence"]],
  "micro/AWS-KEY-2/console-after-report-live": ["clear", ["credentials-used"]],
  "micro/AWS-KEY-2/console-far-after-report-live": ["unknown", ["stale-evidence"]],
  "micro/AZ-KEY-1/key-after-collected-at": ["unknown", ["stale-evidence"]],
  "micro/AZ-KEY-1/latest-evidence-later": ["unknown", ["stale-evidence"]],
  "micro/AZ-KEY-1/key-within-tolerance": ["clear", ["keys-rotated"]],
  "micro/AZ-KEY-1/key-after-collected-at-other-account": ["caution", ["key-not-rotated", "shared-key-off", "stale-evidence", "stale-evidence"]],
  // CC-QA-03 · AWS-NET-1: 모르는 프로토콜 · 포트 · 출발지는 건너뛰지 않는다. 한쪽 끝만 범위 밖인 포트 구간은 안쪽으로 자르고, 구간 전체가 밖이면 해석 불가
  "micro/AWS-NET-1/weird-protocol": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/protocol-trailing-space": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/protocol-empty": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/port-reversed": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/port-negative": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/port-upper-clamped": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/port-all-outside": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/cidr-trailing-space": ["risk", ["sg-public"]],      // 결정 D-1a: 앞뒤 공백은 trim한 뒤 읽는다 → 0.0.0.0/0
  "micro/AWS-NET-1/cidr-garbage-with-v6-world": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/v6-malformed": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/slash-zero-world": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/icmp-from-world": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/weird-protocol-not-world": ["clear", ["sg-closed"]],
  // CC-QA-24 · AWS-NET-1: IP 프로토콜 번호는 0~255의 정규 표기만 '포트 없는 프로토콜'이다. 범위 밖 · 앞자리 0은 모르는 값(확인 불가), 다른 규칙의 위험은 유지
  "micro/AWS-NET-1/protocol-number-256": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/protocol-number-999": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/protocol-leading-zero": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/protocol-number-0": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/protocol-number-255": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/protocol-number-tcp": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/protocol-number-esp": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/protocol-out-of-range-plus-risk": ["risk", ["sg-public"]],
  // CC-QA-13 · ENI 목록이 잘렸으면 '연결 없음'·'공인 IP 없음'을 단정하지 않는다(공인 IP ENI가 보이면 위험은 그대로)
  // CC-QA-04 · CC-QA-14 · AWS-NET-1(결정 D-1 · D-4): 출발지를 주소 범위로 본다
  "micro/AWS-NET-1/v6-trailing-space": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/split-world": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/split-world-three": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/split-world-spaces": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/split-incomplete": ["caution", ["sg-source-broad"]],
  "micro/AWS-NET-1/split-world-unattached": ["caution", ["sg-unattached"]],
  "micro/AWS-NET-1/split-world-mail": ["caution", ["sg-mail"]],
  "micro/AWS-NET-1/broad-v4": ["caution", ["sg-source-broad"]],
  "micro/AWS-NET-1/broad-v4-all-traffic": ["caution", ["sg-source-broad"]],
  "micro/AWS-NET-1/broad-v4-mail": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/broad-v4-other-port": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/broad-v4-web": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/broad-v6": ["caution", ["sg-source-broad"]],
  "micro/AWS-NET-1/private-wide": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/narrow-public": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/host-bits-private": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/prefix-list": ["caution", ["sg-source-prefix-list"]],
  "micro/AWS-NET-1/prefix-list-all-traffic": ["caution", ["sg-source-prefix-list"]],
  "micro/AWS-NET-1/prefix-list-web": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/prefix-list-mail": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/prefix-list-icmp": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/no-source": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/no-source-web": ["unknown", ["value-unrecognized"]],
  "micro/AWS-NET-1/sg-ref-only": ["clear", ["sg-closed"]],
  "micro/AWS-NET-1/world-and-prefix-list": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/mail-and-prefix-list": ["caution", ["sg-source-prefix-list"]],
  "micro/AWS-NET-1/broad-and-prefix-list": ["caution", ["sg-source-broad"]],
  "micro/AWS-NET-1/source-only-caution": ["caution", ["sg-source-broad", "sg-source-prefix-list"]],
  "micro/AWS-NET-1/source-and-unattached": ["caution", ["sg-source-broad", "sg-unattached"]],
  "micro/AWS-NET-1/eni-truncated-unseen": ["caution", ["sg-eni-unknown"]],
  "micro/AWS-NET-1/eni-truncated-public-seen": ["risk", ["sg-public"]],
  "micro/AWS-NET-1/eni-truncated-private-seen": ["caution", ["sg-eni-unknown"]],
  // CC-QA-05 · AWS-KEY-4: 모르는 Effect · 형식 밖 Action · aws ['*'] · 부정형/Null/IfExists ExternalId · 문장 0개
  "micro/AWS-KEY-4/effect-permit": ["unknown", ["value-unrecognized"]],
  "micro/AWS-KEY-4/effect-trailing-space": ["risk", ["trust-wildcard-open"]],
  "micro/AWS-KEY-4/effect-empty": ["unknown", ["value-unrecognized"]],
  "micro/AWS-KEY-4/effect-permit-plus-risk": ["risk", ["trust-wildcard-open"]],
  "micro/AWS-KEY-4/deny-wildcard": ["clear", ["trust-ok"]],
  "micro/AWS-KEY-4/action-garbage": ["risk", ["trust-wildcard-open"]],
  "micro/AWS-KEY-4/action-other-service": ["clear", ["trust-ok"]],
  "micro/AWS-KEY-4/aws-star-without-flag": ["risk", ["trust-wildcard-open"]],
  "micro/AWS-KEY-4/external-null-operator": ["caution", ["trust-external-no-external-id"]],
  "micro/AWS-KEY-4/external-not-equals": ["caution", ["trust-external-no-external-id"]],
  "micro/AWS-KEY-4/external-for-all-values": ["caution", ["trust-external-no-external-id"]],
  "micro/AWS-KEY-4/external-string-like": ["clear", ["trust-ok"]],
  "micro/AWS-KEY-4/external-for-any-value": ["clear", ["trust-ok"]],
  "micro/AWS-KEY-4/external-if-exists": ["caution", ["trust-external-no-external-id"]],
  "micro/AWS-KEY-4/zero-statements": ["unknown", ["value-unrecognized"]],
  // CC-QA-08 · AWS-LOG-1(결정 D-2): 기록 중이어도 로그 전달 오류 기록이 있으면 주의. 빈틈 순서는 기록 중지 > 전달 오류 > 다중 리전 아님
  "micro/AWS-LOG-1/delivery-error": ["caution", ["trail-delivery-error"]],
  "micro/AWS-LOG-1/delivery-error-plus-good": ["clear", ["trail-ok"]],
  "micro/AWS-LOG-1/delivery-error-and-stopped": ["caution", ["trail-not-logging"]],
  "micro/AWS-LOG-1/delivery-error-and-single-region": ["caution", ["trail-delivery-error"]],
  // CC-QA-07 · AWS-LOG-1: 선택기의 모르는 값으로 '관리 이벤트 쓰기 기록'을 확정하지 않는다
  "micro/AWS-LOG-1/unknown-read-write-type": ["unknown", ["value-unrecognized"]],
  "micro/AWS-LOG-1/read-write-type-empty": ["unknown", ["value-unrecognized"]],
  "micro/AWS-LOG-1/write-only": ["clear", ["trail-ok"]],
  "micro/AWS-LOG-1/unknown-plus-all": ["clear", ["trail-ok"]],
  "micro/AWS-LOG-1/management-off": ["caution", ["trail-no-write-events"]],
  "micro/AWS-LOG-1/advanced-read-only-empty": ["unknown", ["value-unrecognized"]],
  "micro/AWS-LOG-1/advanced-read-only-odd": ["unknown", ["value-unrecognized"]],
  "micro/AWS-LOG-1/advanced-read-only-true": ["caution", ["trail-no-write-events"]],
  "micro/AWS-LOG-1/advanced-read-only-false": ["clear", ["trail-ok"]],
  "micro/AWS-LOG-1/advanced-no-read-only": ["clear", ["trail-ok"]],
  // CC-QA-16 · 버킷 리전 조회 실패는 판정을 바꾸지 않는다(MatchKey 동일은 copy-review.test.ts)
  "micro/AWS-STO-2/region-unknown": ["risk", ["block-all-on", "bucket-public-policy"]],
  // CC-QA-17 · AZ-NET-1: 모르는 방향 · 허용 · 프로토콜, 빈 포트 칸은 건너뛰지 않는다. 읽은 조각이 있으면 열린 포트는 그대로 본다
  "micro/AZ-NET-1/unknown-direction": ["unknown", ["value-unrecognized"]],
  "micro/AZ-NET-1/unknown-access": ["unknown", ["value-unrecognized"]],
  "micro/AZ-NET-1/unknown-protocol": ["unknown", ["value-unrecognized"]],
  "micro/AZ-NET-1/empty-port-cell": ["unknown", ["value-unrecognized"]],
  "micro/AZ-NET-1/no-port-cells": ["unknown", ["value-unrecognized"]],
  "micro/AZ-NET-1/partial-port-cells": ["risk", ["nsg-public"]],
  "micro/AZ-NET-1/direction-trailing-space": ["risk", ["nsg-public"]],
  "micro/AZ-NET-1/icmp-from-world": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/outbound-only": ["clear", ["nsg-closed"]],
  // CC-QA-04 · AZ-NET-1(결정 D-1 · D-3): 서비스 태그 · 넓은 대역은 위험 포트에서만 주의, 내부 출발지(VirtualNetwork · AzureLoadBalancer · ASG)와 좁은 출발지는 뺀다
  "micro/AZ-NET-1/service-tag": ["caution", ["nsg-source-service-tag"]],
  "micro/AZ-NET-1/service-tag-regional": ["caution", ["nsg-source-service-tag"]],
  "micro/AZ-NET-1/service-tag-mail": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/service-tag-web": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/gateway-manager": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/virtual-network-source": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/load-balancer-source": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/asg-source": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/no-source": ["unknown", ["value-unrecognized"]],
  "micro/AZ-NET-1/broad-source": ["caution", ["nsg-source-broad"]],
  "micro/AZ-NET-1/broad-source-mail": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/private-wide-source": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/bare-ip-source": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/split-world": ["risk", ["nsg-public"]],
  "micro/AZ-NET-1/split-deny": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/broad-deny": ["risk", ["nsg-public"]],
  "micro/AZ-NET-1/tag-deny": ["risk", ["nsg-public"]],
  "micro/AZ-NET-1/tag-blocked-by-world-deny": ["clear", ["nsg-closed"]],
  "micro/AZ-NET-1/tag-and-world": ["risk", ["nsg-public"]],
  "micro/AZ-NET-1/garbage-source": ["unknown", ["value-unrecognized"]],
  "micro/AZ-NET-1/world-with-garbage": ["risk", ["nsg-public"]],
  "micro/AZ-NET-1/internet-case-trim": ["risk", ["nsg-public"]],
  "micro/AZ-NET-1/source-only-caution": ["caution", ["nsg-source-broad", "nsg-source-service-tag"]],
  "micro/AZ-NET-1/source-and-unattached": ["caution", ["nsg-source-service-tag", "nsg-unattached"]],
  "micro/AZ-NET-1/csv-service-tag": ["caution", ["nsg-source-service-tag"]],
  "micro/AZ-NET-1/csv-no-source": ["unknown", ["value-unrecognized"]],
  // CC-QA-23 · AZ-STO-2: 컨테이너 목록 none(빈 목록 + 값 없음)은 컨테이너 0개다
  "micro/AZ-STO-2/containers-none": ["clear", ["container-private"]],
  "micro/AZ-STO-2/containers-none-only": ["na", []],
};

const slugOf = (code: string): string => (code.includes(":") ? code.split(":")[1] : code);

describe("micro 픽스처 정답표", () => {
  it("정답표와 픽스처 목록이 일대일이다", () => {
    const declared = Object.entries(MICRO).flatMap(([rule, table]) => Object.keys(table).map((n) => `micro/${rule}/${n}`)).sort();
    expect(Object.keys(T).sort()).toEqual(declared);
  });

  describe.each(Object.entries(T))("%s", (ref, [status, reasons]) => {
    const ruleId = ref.split("/")[1] as RuleId;
    const input = resolveFixture(ref);
    const report = judge(input);
    const rule = report.doors.flatMap((d) => d.rules).find((r) => r.ruleId === ruleId);

    it("입력 불변식과 리포트 불변식을 지킨다", () => {
      expect(checkInvariants(input)).toEqual([]);
      expect(checkReport(report)).toEqual([]);
    });
    it(`룰 상태는 ${status}`, () => {
      expect(rule?.status).toBe(status);
    });
    it("대상 사유가 기대와 같다", () => {
      expect(rule?.items.map((i) => slugOf(i.why.code)).sort()).toEqual([...reasons].sort());
    });
  });
});
