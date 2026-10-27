// micro/index — 룰 18장의 micro 픽스처 목록. 룰 데이터의 FixtureRef("micro/<RULE>/<이름>")를 입력으로 바꾼다.
import type { NormalizedInput } from "../../contract/normalized";
import type { RuleId } from "../../model/report";
import { key1, key2, key3, key4, mfa1, mfa2 } from "./aws-iam-cases";
import { log1 } from "./aws-log";
import { net1 } from "./aws-net";
import { sto1, sto2 } from "./aws-sto";
import { azKey1, azLog1, azLog2, azNet1, azNet1Csv, azSto1, azSto2 } from "./azure-cases";

type Factory = () => NormalizedInput;
export const MICRO: Readonly<Record<RuleId, Readonly<Record<string, Factory>>>> = {
  "AWS-MFA-1": { pass: mfa1.pass, "root-key": mfa1.rootKey, "no-mfa": mfa1.noMfa, "recent-login": mfa1.recentLogin, "no-credentials": mfa1.noCredentials, conflict: mfa1.conflict, "no-summary": mfa1.noSummary,
    "not-supported": mfa1.notSupported, "not-supported-none": mfa1.notSupportedNone, "not-supported-no-mfa": mfa1.notSupportedNoMfa,
    "partial-keys-summary-zero": mfa1.partialKeysSummaryZero, "partial-keys-no-summary": mfa1.partialKeysNoSummary, "partial-keys-summary-disagrees": mfa1.partialKeysSummaryDisagrees,
    "partial-keys-active": mfa1.partialKeysActive, "partial-keys-active-no-summary": mfa1.partialKeysActiveNoSummary, "partial-keys-no-mfa-no-summary": mfa1.partialKeysNoMfaNoSummary },
  "AWS-MFA-2": { pass: mfa2.pass, "no-mfa": mfa2.noMfa, "no-console-users": mfa2.noConsoleUsers, empty: mfa2.empty },
  "AWS-KEY-1": {
    pass: key1.pass, "old-key": key1.oldKey, "no-active-keys": key1.noActiveKeys,
    "clock-skew-csv": key1.clockSkewCsv, "clock-skew-within-tolerance": key1.clockSkewWithinTolerance,
    "latest-evidence-later": key1.latestEvidenceLater, "latest-evidence-within-tolerance": key1.latestEvidenceWithinTolerance,
    "created-after-report-csv": key1.createdAfterReportCsv, "created-after-report-live": key1.createdAfterReportLive, "created-long-after-report-live": key1.createdLongAfterReportLive,
  },
  "AWS-KEY-2": { pass: key2.pass, "unused-key": key2.unusedKey, "never-used-key": key2.neverUsedKey, "grace-key": key2.graceKey, "unused-key-report-only": key2.unusedKeyReportOnly, "never-used-key-report-only": key2.neverUsedKeyReportOnly,
    "used-after-report-csv": key2.usedAfterReportCsv, "latest-evidence-later": key2.latestEvidenceLater, "never-used-created-after-report": key2.neverUsedCreatedAfterReport,
    "console-after-report-live": key2.consoleAfterReportLive, "console-far-after-report-live": key2.consoleFarAfterReportLive, "unused-console": key2.unusedConsole, "no-active": key2.noActive },
  "AWS-KEY-3": { pass: key3.pass, "admin-key": key3.adminKey, "admin-via-group": key3.adminViaGroup, "admin-no-key": key3.adminNoKey },
  "AWS-KEY-4": {
    pass: key4.pass, wildcard: key4.wildcard, "wildcard-conditioned": key4.wildcardConditioned, "external-no-external-id": key4.externalNoExternalId,
    "external-org-condition": key4.externalOrgCondition, "only-service-linked": key4.onlyServiceLinked, empty: key4.empty, "deny-and-other-actions": key4.denyAndOtherActions,
    "external-session-principal": key4.externalSessionPrincipal, "canonical-user": key4.canonicalUser, "account-number-principal": key4.accountNumberPrincipal, "self-session-principal": key4.selfSessionPrincipal,
    "wildcard-action": key4.wildcardAction,
    "effect-permit": key4.effectPermit, "effect-trailing-space": key4.effectTrailingSpace, "effect-empty": key4.effectEmpty, "effect-permit-plus-risk": key4.effectPermitPlusRisk,
    "deny-wildcard": key4.denyWildcard, "action-garbage": key4.actionGarbage, "action-other-service": key4.actionOtherService, "aws-star-without-flag": key4.awsStarWithoutFlag,
    "external-null-operator": key4.externalNullOperator, "external-not-equals": key4.externalNotEquals, "external-for-all-values": key4.externalForAllValues,
    "external-string-like": key4.externalStringLike, "external-for-any-value": key4.externalForAnyValue, "external-if-exists": key4.externalIfExists, "zero-statements": key4.zeroStatements,
  },
  "AWS-NET-1": {
    pass: net1.pass, "public-ssh": net1.publicSsh, unattached: net1.unattached, "private-only": net1.privateOnly, "other-port": net1.otherPort, "mail-port": net1.mailPort,
    "all-traffic": net1.allTraffic, "other-region": net1.otherRegion, "ipv6-only": net1.ipv6Only, "no-rules": net1.noRules, empty: net1.empty, "mixed-caution": net1.mixedCaution,
    "weird-protocol": net1.weirdProtocol, "protocol-trailing-space": net1.protocolTrailingSpace, "protocol-empty": net1.protocolEmpty, "port-reversed": net1.portReversed,
    "port-negative": net1.portNegative, "port-upper-clamped": net1.portUpperClamped, "port-all-outside": net1.portAllOutside, "cidr-trailing-space": net1.cidrTrailingSpace,
    "cidr-garbage-with-v6-world": net1.cidrGarbageWithV6World, "v6-malformed": net1.v6Malformed, "slash-zero-world": net1.slashZeroWorld, "icmp-from-world": net1.icmpFromWorld,
    "weird-protocol-not-world": net1.weirdProtocolNotWorld, "eni-truncated-unseen": net1.eniTruncatedUnseen, "eni-truncated-public-seen": net1.eniTruncatedPublicSeen, "eni-truncated-private-seen": net1.eniTruncatedPrivateSeen,
    "protocol-number-256": net1.protocolNumber256, "protocol-number-999": net1.protocolNumber999, "protocol-leading-zero": net1.protocolLeadingZero,
    "protocol-number-0": net1.protocolNumber0, "protocol-number-255": net1.protocolNumber255, "protocol-number-tcp": net1.protocolNumberTcp, "protocol-number-esp": net1.protocolNumberEsp,
    "protocol-out-of-range-plus-risk": net1.protocolOutOfRangePlusRisk,
    "v6-trailing-space": net1.v6TrailingSpace,
    "split-world": net1.splitWorld, "split-world-three": net1.splitWorldThree, "split-world-spaces": net1.splitWorldSpaces, "split-incomplete": net1.splitIncomplete,
    "split-world-unattached": net1.splitWorldUnattached, "split-world-mail": net1.splitWorldMail,
    "broad-v4": net1.broadV4, "broad-v4-all-traffic": net1.broadV4AllTraffic, "broad-v4-mail": net1.broadV4Mail, "broad-v4-other-port": net1.broadV4OtherPort,
    "broad-v4-web": net1.broadV4Web, "broad-v6": net1.broadV6, "private-wide": net1.privateWide, "narrow-public": net1.narrowPublic, "host-bits-private": net1.hostBitsPrivate,
    "prefix-list": net1.prefixList, "prefix-list-all-traffic": net1.prefixListAllTraffic, "prefix-list-web": net1.prefixListWeb, "prefix-list-mail": net1.prefixListMail,
    "prefix-list-icmp": net1.prefixListIcmp, "no-source": net1.noSource, "no-source-web": net1.noSourceWeb, "sg-ref-only": net1.sgRefOnly,
    "world-and-prefix-list": net1.worldAndPrefixList, "mail-and-prefix-list": net1.mailAndPrefixList, "broad-and-prefix-list": net1.broadAndPrefixList,
    "source-only-caution": net1.sourceOnlyCaution, "source-and-unattached": net1.sourceAndUnattached,
  },
  "AWS-STO-1": { pass: sto1.pass, partial: sto1.partial, "no-config": sto1.noConfig },
  "AWS-STO-2": {
    pass: sto2.pass, "public-policy": sto2.publicPolicy, "public-acl": sto2.publicAcl, "website-public": sto2.websitePublic, "block-off": sto2.blockOff,
    "policy-restricted": sto2.policyRestricted, empty: sto2.empty, "acl-enabled": sto2.aclEnabled,
    "region-unknown": sto2.regionUnknown, "acl-enabled-preferred": sto2.aclEnabledPreferred, "acl-enabled-unset": sto2.aclEnabledUnset, "acl-enabled-other": sto2.aclEnabledOther,
  },
  "AWS-LOG-1": { "delivery-error": log1.deliveryError, "delivery-error-plus-good": log1.deliveryErrorPlusGood, "delivery-error-and-stopped": log1.deliveryErrorAndStopped, "delivery-error-and-single-region": log1.deliveryErrorAndSingleRegion, "unknown-read-write-type": log1.unknownReadWriteType, "read-write-type-empty": log1.readWriteTypeEmpty, "write-only": log1.writeOnly, "unknown-plus-all": log1.unknownPlusAll, "management-off": log1.managementOff, "advanced-read-only-empty": log1.advancedReadOnlyEmpty, "advanced-read-only-odd": log1.advancedReadOnlyOdd, "advanced-read-only-true": log1.advancedReadOnlyTrue, "advanced-read-only-false": log1.advancedReadOnlyFalse, "advanced-no-read-only": log1.advancedNoReadOnly, pass: log1.pass, "no-trail": log1.noTrail, stopped: log1.stopped, "single-region": log1.singleRegion, "no-validation": log1.noValidation, "read-only": log1.readOnly, "one-good": log1.oneGood },
  "AZ-MFA-G": {},
  "AZ-MFA-1": {},
  "AZ-KEY-1": { "latest-evidence-later": azKey1.latestEvidenceLater, "key-after-collected-at": azKey1.keyAfterCollectedAt, "key-within-tolerance": azKey1.keyWithinTolerance, "key-after-collected-at-other-account": azKey1.keyAfterCollectedAtOtherAccount, pass: azKey1.pass, "old-key": azKey1.oldKey, "no-record": azKey1.noRecord, empty: azKey1.empty },
  "AZ-NET-1": {
    pass: azNet1.pass, "public-rdp": azNet1.publicRdp, unattached: azNet1.unattached, "private-only": azNet1.privateOnly, "denied-first": azNet1.deniedFirst,
    "via-subnet": azNet1.viaSubnet, "port-range": azNet1.portRange, "mail-port": azNet1.mailPort,
    "csv-attachment-unknown": azNet1Csv.attachmentUnknown, "csv-no-risk": azNet1Csv.noRisk, empty: azNet1.empty, "mixed-caution": azNet1.mixedCaution,
    "unknown-direction": azNet1.unknownDirection, "unknown-access": azNet1.unknownAccess, "unknown-protocol": azNet1.unknownProtocol, "empty-port-cell": azNet1.emptyPortCell,
    "no-port-cells": azNet1.noPortCells, "partial-port-cells": azNet1.partialPortCells, "direction-trailing-space": azNet1.directionTrailingSpace, "icmp-from-world": azNet1.icmpFromWorld,
    "outbound-only": azNet1.outboundOnly,
    "service-tag": azNet1.serviceTag, "service-tag-regional": azNet1.serviceTagRegional, "service-tag-mail": azNet1.serviceTagMail, "service-tag-web": azNet1.serviceTagWeb,
    "gateway-manager": azNet1.gatewayManager, "virtual-network-source": azNet1.virtualNetworkSource, "load-balancer-source": azNet1.loadBalancerSource, "asg-source": azNet1.asgSource,
    "no-source": azNet1.noSource, "broad-source": azNet1.broadSource, "broad-source-mail": azNet1.broadSourceMail, "private-wide-source": azNet1.privateWideSource,
    "bare-ip-source": azNet1.bareIpSource, "split-world": azNet1.splitWorld, "split-deny": azNet1.splitDeny, "broad-deny": azNet1.broadDeny, "tag-deny": azNet1.tagDeny,
    "tag-blocked-by-world-deny": azNet1.tagBlockedByWorldDeny, "tag-and-world": azNet1.tagAndWorld, "garbage-source": azNet1.garbageSource, "world-with-garbage": azNet1.worldWithGarbage,
    "internet-case-trim": azNet1.internetCaseTrim, "source-only-caution": azNet1.sourceOnlyCaution, "source-and-unattached": azNet1.sourceAndUnattached,
    "csv-service-tag": azNet1Csv.serviceTag, "csv-no-source": azNet1Csv.noSource,
  },
  "AZ-STO-1": { pass: azSto1.pass, "allow-true": azSto1.allowTrue, "allow-unset": azSto1.allowUnset, empty: azSto1.empty },
  "AZ-STO-2": {
    "containers-none": azSto2.containersNone, "containers-none-only": azSto2.containersNoneOnly, pass: azSto2.pass, "public-container": azSto2.publicContainer, "web-container": azSto2.webContainer, "account-blocks": azSto2.accountBlocks,
    "no-containers": azSto2.noContainers, empty: azSto2.empty, "access-unreadable": azSto2.accessUnreadable,
  },
  "AZ-LOG-1": {
    pass: azLog1.pass, "no-export": azLog1.noExport, "categories-missing": azLog1.categoriesMissing, "event-hub-only": azLog1.eventHubOnly,
    "all-logs-group": azLog1.allLogsGroup, "audit-group-only": azLog1.auditGroupOnly, empty: azLog1.empty, "both-destinations": azLog1.bothDestinations,
  },
  "AZ-LOG-2": {
    pass: azLog2.pass, "no-diagnostics": azLog2.noDiagnostics, "categories-missing": azLog2.categoriesMissing, "audit-group": azLog2.auditGroup,
    "disabled-category": azLog2.disabledCategory, empty: azLog2.empty,
  },
};

/** "micro/AWS-MFA-2/pass" → 입력 */
export function resolveFixture(ref: string): NormalizedInput {
  const m = /^micro\/([A-Za-z0-9-]+)\/([a-z0-9-]+)$/.exec(ref);
  if (m === null) throw new Error(`픽스처 참조 형식 오류: ${ref}`);
  const table = (MICRO as Record<string, Readonly<Record<string, Factory>> | undefined>)[m[1]];
  const f = table?.[m[2]];
  if (f === undefined) throw new Error(`없는 픽스처: ${ref}`);
  return f();
}
