#!/usr/bin/env bash
# 문단속 5 수집기(Azure) — 읽기 전용 호출만으로 결과 파일 1개(JSON)를 만든다. 쓰기 호출은 없다.
# 키 값·연결 문자열·SAS·태그·UPN·오류 메시지 원문은 읽지도 저장하지도 않는다. 위(공용 함수)에서 아래(구간)로 읽으면 된다.
set -euo pipefail
umask 077
export LC_ALL=C AZURE_CORE_COLLECT_TELEMETRY=false AZURE_CORE_NO_COLOR=true
CC_NAME=cloudcheck-azure CC_VERSION=1.0.0 CC_SCHEMA=cloudcheck.collect/1.0 LIM_SUBS=20 LIM_ACCTS=100
TMP="" OUT_TMP="" ACC="" LR="" N=0 YES=0 PRINT=0 DOORS=key,net,sto,log SUBS_REQ="" REQ="[]" RESULT="" CODE="" LAST_ID="" TENANT="" CONFIRMED="" T0="" SELF_SHA="" CLI_VER="" JQ_VER=""

# @cc:section common — 공용 함수
# 안내는 표준 오류로만 낸다(--print의 결과 JSON과 섞이지 않게)
say() { printf '%s\n' "$*" >&2; }
# 치명 오류: 메시지를 내고 지정한 종료 코드로 끝낸다(결과 파일은 만들지 않는다)
die() { local code=$1; shift; say "$*"; exit "$code"; }
# 요청한 문(--doors)에 인자 중 하나라도 들어 있으면 성공 / 필요한 도구가 없으면 클라우드 호출 없이 끝낸다
want() { local d; for d in "$@"; do case ",$DOORS," in *",$d,"*) return 0;; esac; done; return 1; }
need() { if ! command -v "$1" >"$TMP/w"; then die 4 "$1 명령을 찾을 수 없습니다. 아무것도 수집하지 않고 끝냅니다."; fi; }
# call 직후의 {receipt, value}를 파일로 보관 / 섹션을 {"키": 값} 조각으로 저장(마지막에 합친다) / 줄 모음을 배열 조각으로 저장
keep() { cat "$TMP/val" >"$TMP/$1"; }
put() { jq -c --arg k "$1" '{($k): .}' "$TMP/${2:-val}" >"$TMP/p.$1"; }
putl() { jq -sc --arg k "$1" '{($k): .}' "$TMP/$2" >"$TMP/p.$1"; }
# stderr에서 오류 코드 토큰만 뽑아 결과를 분류한다(메시지 원문에는 UPN·구독 이름이 들어 있을 수 있어 버린다)
classify() {
  local rc=$1 msg re1='Code: ([A-Za-z0-9._]+)' re2='ERROR: \(([A-Za-z0-9._]+)\)' re3='(AADSTS[0-9]+)'
  msg=$(head -c 4000 "$TMP/err")
  CODE="cli-exit-$rc"
  if [[ $msg =~ $re1 ]]; then CODE=${BASH_REMATCH[1]:0:80}
  elif [[ $msg =~ $re2 ]]; then CODE=${BASH_REMATCH[1]:0:80}
  elif [[ $msg =~ $re3 ]]; then CODE=${BASH_REMATCH[1]}
  elif [[ $msg == *"az login"* ]]; then CODE=not-logged-in; fi
  case "$CODE" in
    AuthorizationFailed|LinkedAuthorizationFailed|AuthorizationPermissionMismatch|Forbidden|InvalidAuthenticationTokenTenant) RESULT=denied ;;
    TooManyRequests|SubscriptionRequestsThrottled|ResourceRequestsThrottled|TenantRequestsThrottled) RESULT=throttled ;;
    MissingSubscriptionRegistration|FeatureNotSupportedForAccount|NoRegisteredProviderFound|InvalidResourceType|cli-exit-2) RESULT=unsupported ;;
    *) RESULT=error ;;
  esac
}
# call <영수증 call> <구독|-> <리소스|-> <개수 식|null> <jq 투영> -- <명령...> : 호출 1건 + 영수증 1줄. 실패해도 중단하지 않고 value=null로 남긴다
# ACC=<파일> call …로 부르면 {receipt, value} 한 줄을 그 파일 끝에 쌓는다(항목별 호출의 결과 칸 모음)
call() {
  local label=$1 sub=$2 res=$3 cexpr=$4 proj=$5 rc=0 count=null; shift 6
  N=$((N + 1)); LAST_ID=$(printf 'r-%04d' "$N"); CODE=""; RESULT=ok
  "$@" <"$TMP/empty" >"$TMP/out" 2>"$TMP/err" || rc=$?
  if [ "$rc" != 0 ]; then classify "$rc"
  elif ! count=$(jq -c "$cexpr" "$TMP/out" 2>"$TMP/err"); then RESULT=error; CODE=output-not-json
  elif ! jq -c --arg tenant "$TENANT" --argjson req "$REQ" --argjson lim "$LIM_SUBS" "$proj" "$TMP/out" >"$TMP/v" 2>"$TMP/err"; then RESULT=error; CODE=transform-failed
  elif [ ! -s "$TMP/v" ]; then RESULT=error; CODE=transform-failed
  elif [ "$count" = 0 ]; then RESULT=empty
  fi
  if [ -z "$count" ]; then count=null; fi
  case "$RESULT" in ok|empty) ;; *) printf 'null' >"$TMP/v" ;; esac
  jq -nc --arg id "$LAST_ID" --arg call "$label" --arg sub "$sub" --arg res "$res" --arg result "$RESULT" --arg code "$CODE" --argjson count "$count" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{id: $id, call: $call} + (if $sub == "-" then {} else {subscription: $sub} end) + {resource: (if $res == "-" then null else $res end), result: $result, count: (if $result == "ok" or $result == "empty" then $count else null end), errorCode: (if $code == "" then null else $code end), at: $at}' >>"$TMP/receipts"
  jq -c --arg r "$LAST_ID" '{receipt: $r, value: .}' "$TMP/v" >"$TMP/val"
  if [ -n "$ACC" ]; then cat "$TMP/val" >>"$TMP/$ACC"; fi
  if [ $((N % 25)) = 0 ]; then say "  호출 $N건째 …"; fi
}
# 계정별 조회 1건: 요청하지 않은 문이면 호출하지 않고 빈 칸만 남긴다(파서는 그 칸을 쓰지 않는다)
slot() {
  local door=$1 file=$2; shift 2
  if want "$door"; then ACC=$file call "$@"; else printf '{"receipt":"%s","value":null}\n' "$LR" >>"$TMP/$file"; fi
}
# 구독마다 {subscription, receipt, items} 한 줄을 파일 끝에 쌓는다
perSub() { jq -c --arg s "$1" '{subscription: $s, receipt: .receipt, items: .value}' "$TMP/val" >>"$TMP/$2"; }

# @cc:section prepare — 준비: 인자, 도구 버전, 이 파일의 해시
parse_args() {
  local dr='(key|net|sto|log)' ur='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  while [ $# -gt 0 ]; do
    case "$1" in
      --yes) YES=1 ;;
      --print) PRINT=1 ;;
      --doors|--subscriptions) if [ $# -lt 2 ]; then die 2 "$1 뒤에 값이 필요합니다."; fi; if [ "$1" = --doors ]; then DOORS=$2; else SUBS_REQ=$2; fi; shift ;;
      --version) printf '%s %s\n' "$CC_NAME" "$CC_VERSION"; exit 0 ;;
      --help|-h) printf '%s\n' "사용: bash $CC_NAME.sh [--doors key,net,sto,log] [--subscriptions ID1,ID2] [--yes] [--print]" "  --doors          수집할 문(기본: 전부 · mfa는 수집기가 아니라 포털 안내)" "  --subscriptions  조회할 구독 ID(기본: 이 테넌트의 사용 가능한 구독 전부)" "  --yes            계정 확인과 마지막 삭제 질문을 건너뜁니다" "  --print          결과 JSON을 화면(표준 출력)에도 냅니다"; exit 0 ;;
      *) die 2 "알 수 없는 인자: $1 (--help 참고)" ;;
    esac
    shift
  done
  if [[ ! $DOORS =~ ^$dr(,$dr)*$ ]]; then die 2 "--doors 값은 key,net,sto,log 중 쉼표로 이어서 적습니다."; fi
  if [ -n "$SUBS_REQ" ] && [[ ! $SUBS_REQ =~ ^$ur(,$ur)*$ ]]; then die 2 "--subscriptions 값이 구독 ID 형식이 아닙니다."; fi
}
# 도구 버전과 이 파일의 해시를 기록한다(버전 확인용이며 보안 증거가 아니다)
# az version은 설치된 버전만 읽는다(az --version은 최신 버전을 인터넷에서 조회하므로 쓰지 않는다)
tools() {
  local h v
  if az version -o json --only-show-errors >"$TMP/ver" 2>"$TMP/w" && v=$(jq -r '"azure-cli/" + ((."azure-cli" // "unknown") | tostring | .[0:40])' "$TMP/ver" 2>"$TMP/w"); then CLI_VER=$v; fi
  JQ_VER=$(jq --version)
  if h=$(sha256sum "$0" 2>"$TMP/w"); then SELF_SHA=${h:0:64}; elif h=$(shasum -a 256 "$0" 2>"$TMP/w"); then SELF_SHA=${h:0:64}; fi
}

# @cc:section identity — 신원과 범위: 어느 테넌트의 어느 구독을 볼지 보여 주고 확인받는다
identity() {
  local ur='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  # @cc:identity.account 현재 로그인한 테넌트·구독·주체 유형(UPN·표시 이름·개체 ID는 버린다)
  call azure:account.show - - null '{tenantId: (.tenantId | ascii_downcase), currentSubscription: (.id | ascii_downcase), cloudName: (.environmentName | .[0:32]), principalType: (if .user.type == "user" then "user" elif .user.type == "servicePrincipal" then (if (.user.name == "systemAssignedIdentity" or .user.name == "userAssignedIdentity") then "managedIdentity" else "servicePrincipal" end) else "unknown" end)}' -- az account show -o json --only-show-errors
  if [ "$RESULT" != ok ]; then die 4 "신원을 확인하지 못했습니다($CODE). 아무것도 수집하지 않고 끝냅니다."; fi
  keep id
  TENANT=$(jq -r '.value.tenantId // ""' "$TMP/id")
  if [[ ! "$TENANT:$(jq -r '.value.currentSubscription // ""' "$TMP/id")" =~ ^$ur:$ur$ ]]; then die 4 "테넌트·구독 ID를 읽지 못했습니다. 아무것도 수집하지 않고 끝냅니다."; fi
  say "테넌트 ID : $TENANT"
  jq -r '"구독 이름  : \(.name | @json)"' "$TMP/out" >&2
  if [ -n "$SUBS_REQ" ]; then REQ=$(jq -nc --arg r "$SUBS_REQ" '$r | split(",") | map(ascii_downcase)'); fi
  # @cc:scope.subscriptions 구독 목록(ID·이름·상태·테넌트만): 이 테넌트의 사용 가능한 구독만 조회하고 나머지는 사유와 함께 기록만 한다
  call azure:account.list - - length '[.[] | {id: (.id | ascii_downcase), name: (.name | .[0:256]), state: .state, tenantId: (.tenantId | ascii_downcase)} | . as $s | . + {outOfScopeReason: (if $s.tenantId != $tenant then "other-tenant" elif $s.state != "Enabled" then "not-enabled" elif ($req | length) > 0 and ([$req[] | select(. == $s.id)] | length) == 0 then "not-requested" else null end)}] | sort_by(.id) | . as $all | ([range(0; length) | select($all[.].outOfScopeReason == null)] | .[$lim:]) as $over | [range(0; length) as $i | $all[$i] | (if ([$over[] | select(. == $i)] | length) > 0 then .outOfScopeReason = "not-requested" else . end) | . + {inScope: (.outOfScopeReason == null)}]' -- az account list --all -o json --only-show-errors
  keep subs
  jq -r '(.value // [])[] | select(.inScope) | .id' "$TMP/subs" >"$TMP/subs.txt"
  say "구독 $(jq -r '(.value // []) | length' "$TMP/subs")개 중 $(jq -r '[(.value // [])[] | select(.inScope)] | length' "$TMP/subs")개를 조회합니다(다른 테넌트·사용 불가·제한한 구독은 기록만 합니다)"
}
# C-05 계정 확인: 대화형이면 Enter를 기다리고, 아니면 --yes가 있어야 진행한다
confirm() {
  if [ "$YES" = 1 ]; then CONFIRMED=flag-yes; return 0; fi
  if [ -t 0 ]; then read -r -p "이 테넌트가 맞으면 Enter, 아니면 Ctrl+C: " _; CONFIRMED=interactive; return 0; fi
  die 3 "대화형 터미널이 아니면 --yes가 필요합니다. 아무것도 수집하지 않고 끝냅니다."
}

# @cc:section storage — 열쇠·창고·CCTV가 함께 쓰는 스토리지 계정 목록과 계정별 컨테이너·Blob 진단 설정
door_storage() {
  local s a
  while IFS= read -r s; do
    # @cc:storage.accounts 구독의 스토리지 계정(키 값·엔드포인트·태그는 읽지 않는다 · 키 생성 시각과 정책 기간만 쓴다)
    call azure:storage.account.list "$s" - length '[.[] | {id: .id, name: .name, kind: (.kind // null), location: .location, allowBlobPublicAccess: .allowBlobPublicAccess, allowSharedKeyAccess: .allowSharedKeyAccess, keyCreationTime: (if .keyCreationTime == null then null else {key1: (.keyCreationTime.key1 // null), key2: (.keyCreationTime.key2 // null)} end), keyExpirationPeriodInDays: (.keyPolicy.keyExpirationPeriodInDays // null), sasExpirationPeriod: (.sasPolicy.sasExpirationPeriod // null), publicNetworkAccess: (.publicNetworkAccess // null), networkDefaultAction: (.networkRuleSet.defaultAction // null)}] | sort_by(.id | ascii_downcase)' -- az storage account list --subscription "$s" -o json --only-show-errors
    keep sl; LR=$LAST_ID
    jq -r --argjson lim "$LIM_ACCTS" '(.value // [])[0:$lim][].id' "$TMP/sl" >"$TMP/accts.txt"
    : >"$TMP/a.ct"; : >"$TMP/a.bd"
    while IFS= read -r a; do
      # @cc:sto.containers 컨테이너 이름과 공개 수준(관리 평면 명령만 쓴다 · 데이터 평면은 계정 키를 암묵 조회할 수 있어 금지)
      slot sto a.ct azure:storage.container-rm.list "$s" "$a" length '[.[] | {name: (.name | .[0:63]), publicAccess: (.publicAccess // null)}]' -- az storage container-rm list --storage-account "$a" --subscription "$s" -o json --only-show-errors
      # @cc:log.blob-diagnostics Blob 서비스 진단 설정(로그 범주와 보내는 곳 종류만 · 출력이 value 래퍼여도 배열이어도 받는다)
      slot log a.bd azure:monitor.diagnostic-settings.list "$s" "$a" '(.value? // .) | length' '[(.value? // .)[]? | {name: (.name | .[0:260]), logs: [(.logs // [])[] | {category: (.category // null), categoryGroup: (.categoryGroup // null), enabled: (.enabled == true)}], destinations: {workspace: ((.workspaceId // null) != null), storage: ((.storageAccountId // null) != null), eventHub: ((.eventHubAuthorizationRuleId // null) != null), partner: ((.marketplacePartnerId // null) != null)}}]' -- az monitor diagnostic-settings list --resource "$a/blobServices/default" --subscription "$s" -o json --only-show-errors
    done <"$TMP/accts.txt"
    jq -c --arg s "$s" --argjson lim "$LIM_ACCTS" --slurpfile ct "$TMP/a.ct" --slurpfile bd "$TMP/a.bd" '.receipt as $lr | (.value // []) as $it | ([($it | length), $lim] | min) as $n | {subscription: $s, receipt: $lr, budget: {limit: $lim, total: ($it | length), collected: $n}, items: (if .value == null then null else [range(0; $it | length) as $i | $it[$i] + (if $i < $n then {containers: $ct[$i], blobDiagnostics: $bd[$i]} else {containers: {receipt: $lr, value: null}, blobDiagnostics: {receipt: $lr, value: null}} end)] end)}' "$TMP/sl" >>"$TMP/s.l"
  done <"$TMP/subs.txt"
  putl storageAccounts s.l
}

# @cc:section net — 창문: 구독마다 NSG 규칙, NIC 연결, 공인 IP(주소 값은 버린다)
door_net() {
  local s
  while IFS= read -r s; do
    # @cc:net.nsgs NSG와 인바운드 규칙(출발지·목적지 포트·허용 여부 · 기본 규칙과 목적지 주소는 읽지 않는다)
    call azure:network.nsg.list "$s" - length '[.[] | {id: .id, name: (.name | .[0:80]), location: .location, rules: [(.securityRules // [])[] | {name: (.name | .[0:80]), direction: .direction, access: .access, priority: .priority, protocol: .protocol, sourcePrefixes: (([.sourceAddressPrefix] + (.sourceAddressPrefixes // [])) | map(select(. != null and . != "") | .[0:128])), sourceAsgCount: ((.sourceApplicationSecurityGroups // []) | length), destPortRanges: (([.destinationPortRange] + (.destinationPortRanges // [])) | map(select(. != null and . != "") | .[0:32]))}], nicIds: [(.networkInterfaces // [])[]?.id], subnetIds: [(.subnets // [])[]?.id]}]' -- az network nsg list --subscription "$s" -o json --only-show-errors
    perSub "$s" n.nsg
    # @cc:net.nics NIC가 어떤 NSG·서브넷·공인 IP에 연결됐는지(사설 IP는 버린다)
    call azure:network.nic.list "$s" - length '[.[] | {id: .id, nsgId: (.networkSecurityGroup.id // null), ipConfigs: [(.ipConfigurations // [])[] | {subnetId: (.subnet.id // null), publicIpId: (.publicIPAddress.id // null)}]}]' -- az network nic list --subscription "$s" -o json --only-show-errors
    perSub "$s" n.nic
    # @cc:net.public-ips 공인 IP 리소스: 주소가 배정됐는지와 연결 대상만(주소 값·DNS 이름은 버린다)
    call azure:network.public-ip.list "$s" - length '[.[] | {id: .id, hasAddress: ((.ipAddress // null) != null), allocationMethod: (.publicIPAllocationMethod // null), attachedTo: (.ipConfiguration.id // null)}]' -- az network public-ip list --subscription "$s" -o json --only-show-errors
    perSub "$s" n.ip
  done <"$TMP/subs.txt"
  putl nsgs n.nsg; putl nics n.nic; putl publicIps n.ip
}

# @cc:section log — CCTV: 구독 활동 로그를 내보내는 진단 설정(Blob 접근 기록은 storage 구간에서 읽는다)
door_log() {
  local s
  while IFS= read -r s; do
    # @cc:log.activity-log 구독 활동 로그 내보내기 설정(로그 범주와 보내는 곳 종류만 · 대상 리소스 ID는 버린다)
    call azure:monitor.diagnostic-settings.subscription.list "$s" - '(.value? // .) | length' '[(.value? // .)[]? | {name: (.name | .[0:260]), logs: [(.logs // [])[] | {category: (.category // null), categoryGroup: (.categoryGroup // null), enabled: (.enabled == true)}], destinations: {workspace: ((.workspaceId // null) != null), storage: ((.storageAccountId // null) != null), eventHub: ((.eventHubAuthorizationRuleId // null) != null), partner: ((.marketplacePartnerId // null) != null)}}]' -- az monitor diagnostic-settings subscription list --subscription "$s" -o json --only-show-errors
    perSub "$s" l.al
  done <"$TMP/subs.txt"
  putl activityLogExports l.al
}

# @cc:section assemble — 조립: 조각을 합쳐 결과 파일 1개를 만들고, 필요하면 화면에 출력한다
finish() {
  local out="cloudcheck-azure-${TENANT: -4}-$(date -u +%Y%m%dT%H%M%SZ).json"
  OUT_TMP=$(mktemp "$out.XXXXXX")
  jq -sc 'add' "$TMP"/p.* >"$TMP/data"
  jq -nc --arg schema "$CC_SCHEMA" --arg name "$CC_NAME" --arg ver "$CC_VERSION" --arg sha "$SELF_SHA" --arg cli "$CLI_VER" --arg jqv "$JQ_VER" --arg bv "$BASH_VERSION" --arg t0 "$T0" --arg t1 "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg conf "$CONFIRMED" --arg doors "$DOORS" --arg req "$SUBS_REQ" --slurpfile id "$TMP/id" --slurpfile subs "$TMP/subs" --slurpfile rc "$TMP/receipts" --slurpfile data "$TMP/data" '($doors | split(",")) as $d | def st($x): if ([$d[] | select(. == $x)] | length) > 0 then "collected" else "skipped" end; {schema: $schema, collector: {name: $name, version: $ver, sha256: (if $sha == "" then null else $sha end), tools: {cli: (if $cli == "" then null else $cli[0:64] end), jq: (if $jqv == "" then null else $jqv[0:32] end), bash: $bv[0:32]}}, cloud: "azure", collectedAt: $t0, run: {finishedAt: $t1, confirmed: $conf, doors: {mfa: "skipped", key: st("key"), net: st("net"), sto: st("sto"), log: st("log")}}, identity: ({receipt: $id[0].receipt} + $id[0].value), scope: {subscriptions: $subs[0], subscriptionsRequested: (if $req == "" then null else ($req | split(",") | map(ascii_downcase)) end)}, receipts: $rc, data: $data[0]}' >"$OUT_TMP"
  mv "$OUT_TMP" "$out"; OUT_TMP=""
  say "결과 파일: $out  (호출 $N건)"
  if [ "$PRINT" = 1 ]; then cat "$out"; fi
  if [ "$YES" = 0 ] && [ -t 0 ]; then
    read -r -p "내려받았거나 복사했으면 Enter를 누르세요. 그러면 이 파일을 지웁니다(지우지 않으려면 Ctrl+C): " _
    rm -f "$out"; say "결과 파일을 지웠습니다."
  fi
}

main() {
  TMP=$(mktemp -d); trap 'rm -rf "$TMP" "$OUT_TMP"' EXIT
  for f in empty receipts s.l n.nsg n.nic n.ip l.al; do : >"$TMP/$f"; done
  parse_args "$@"
  need jq; need az; tools
  say "문단속 5 수집기(Azure) $CC_VERSION — 읽기 전용 호출만 사용합니다"
  identity; confirm
  T0=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  if want key sto log; then say "[열쇠·창고·CCTV] 스토리지 계정 정보를 읽습니다"; door_storage; fi
  if want net; then say "[창문] 구독별 네트워크 설정을 읽습니다"; door_net; fi
  if want log; then say "[CCTV] 구독 활동 로그 설정을 읽습니다"; door_log; fi
  finish
}

main "$@"
