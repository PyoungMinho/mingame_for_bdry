#!/usr/bin/env bash
# 문단속 5 수집기(AWS) — 읽기 전용 호출만으로 결과 파일 1개(JSON)를 만든다. 쓰기 호출은 보고서 생성 요청 1건뿐이다.
# 정책 전문·태그·키 값·IP 값·오류 메시지 원문은 읽지도 저장하지도 않는다. 위(공용 함수)에서 아래(문 단위 구간)로 읽으면 된다.
set -euo pipefail
umask 077
# 요청 주소는 고정한다: 환경변수·설정 파일의 엔드포인트 지정은 무시한다(프록시·인증서 설정은 평소 aws 명령처럼 따른다)
export LC_ALL=C AWS_PAGER="" AWS_RETRY_MODE=standard AWS_MAX_ATTEMPTS=6 AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true
CC_NAME=cloudcheck-aws CC_VERSION=1.0.0 CC_SCHEMA=cloudcheck.collect/1.0 LIM_USERS=150 LIM_BUCKETS=300
TMP="" OUT_TMP="" ACC="" N=0 YES=0 PRINT=0 DOORS=mfa,key,net,sto,log REGIONS_REQ="" RESULT="" CODE="" LAST_ID="" LU="" LB="" ACCT="" CONFIRMED="" T0="" SELF_SHA="" CLI_VER="" JQ_VER=""

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
# stderr에서 오류 코드 토큰만 뽑아 결과를 분류한다(메시지 원문에는 ARN·이메일이 들어 있을 수 있어 버린다)
classify() {
  local rc=$1 re='An error occurred \(([A-Za-z0-9._]+)\)' msg
  msg=$(head -c 4000 "$TMP/err")
  CODE="cli-exit-$rc"
  if [[ $msg =~ $re ]]; then CODE=${BASH_REMATCH[1]:0:80}; fi
  case "$CODE" in
    AccessDenied|AccessDeniedException|UnauthorizedOperation|UnauthorizedAccess|AuthFailure|AllAccessDisabled) RESULT=denied ;;
    NoSuchPublicAccessBlockConfiguration|NoSuchBucketPolicy|NoSuchWebsiteConfiguration|OwnershipControlsNotFoundError) RESULT=notconfigured ;;
    Throttling|ThrottlingException|ThrottledException|RequestLimitExceeded|RequestThrottled|RequestThrottledException|SlowDown|TooManyRequestsException) RESULT=throttled ;;
    OptInRequired|InvalidAction|UnsupportedOperation|UnknownOperationException|NotImplemented|cli-exit-252|cli-exit-2) RESULT=unsupported ;;
    *) RESULT=error ;;
  esac
}
# call <영수증 call> <리전> <리소스|-> <목록 경로|-> <jq 투영> -- <명령...> : 호출 1건 + 영수증 1줄. 실패해도 중단하지 않고 value=null로 남긴다
# ACC=<파일> call …로 부르면 {receipt, value} 한 줄을 그 파일 끝에 쌓는다(항목별 호출의 결과 칸 모음)
call() {
  local label=$1 region=$2 res=$3 cpath=$4 proj=$5 rc=0 count=null; shift 6
  N=$((N + 1)); LAST_ID=$(printf 'r-%04d' "$N"); CODE=""; RESULT=ok
  "$@" <"$TMP/empty" >"$TMP/out" 2>"$TMP/err" || rc=$?
  if [ "$rc" != 0 ]; then classify "$rc"
  elif ! jq -c --arg cp "$cpath" '{n: (if $cp == "-" then null else ((getpath($cp | ltrimstr(".") | split(".")) // []) | length) end), t: ([.. | objects | select((.NextToken // .ContinuationToken // .Marker) != null or .IsTruncated == true)] | length > 0)}' "$TMP/out" >"$TMP/meta" 2>"$TMP/err"; then RESULT=error; CODE=output-not-json
  elif ! jq -c "$proj" "$TMP/out" >"$TMP/v" 2>"$TMP/err"; then RESULT=error; CODE=transform-failed
  elif [ ! -s "$TMP/v" ]; then RESULT=error; CODE=transform-failed
  else
    count=$(jq '.n' "$TMP/meta")
    if [ "$count" = 0 ]; then RESULT=empty; fi
    if [ "$(jq '.t' "$TMP/meta")" = true ]; then RESULT=truncated; if [ "$count" = null ]; then count=0; fi; fi
  fi
  case "$RESULT" in ok|empty|truncated) ;; *) printf 'null' >"$TMP/v" ;; esac
  jq -nc --arg id "$LAST_ID" --arg call "$label" --arg region "$region" --arg res "$res" --arg result "$RESULT" --arg code "$CODE" --argjson count "$count" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{id: $id, call: $call, region: $region, resource: (if $res == "-" then null else $res end), result: $result, count: (if $result == "ok" or $result == "empty" or $result == "truncated" then $count else null end), errorCode: (if $code == "" then null else $code end), at: $at}' >>"$TMP/receipts"
  jq -c --arg r "$LAST_ID" '{receipt: $r, value: .}' "$TMP/v" >"$TMP/val"
  if [ -n "$ACC" ]; then cat "$TMP/val" >>"$TMP/$ACC"; fi
  if [ $((N % 25)) = 0 ]; then say "  호출 $N건째 …"; fi
}
# 사용자별 조회 1건: 요청하지 않은 문이면 호출하지 않고 빈 칸만 남긴다(파서는 그 칸을 쓰지 않는다)
slot() {
  local door=$1 file=$2; shift 2
  if want "$door"; then ACC=$file call "$@"; else printf '{"receipt":"%s","value":null}\n' "$LU" >>"$TMP/$file"; fi
}

# @cc:section prepare — 준비: 인자, 도구 버전, 이 파일의 해시
parse_args() {
  local dr='(mfa|key|net|sto|log)' rr='[a-z]{2}(-[a-z]+)+-[0-9]{1,2}'
  while [ $# -gt 0 ]; do
    case "$1" in
      --yes) YES=1 ;;
      --print) PRINT=1 ;;
      --doors|--regions) if [ $# -lt 2 ]; then die 2 "$1 뒤에 값이 필요합니다."; fi; if [ "$1" = --doors ]; then DOORS=$2; else REGIONS_REQ=$2; fi; shift ;;
      --version) printf '%s %s\n' "$CC_NAME" "$CC_VERSION"; exit 0 ;;
      --help|-h) printf '%s\n' "사용: bash $CC_NAME.sh [--doors mfa,key,net,sto,log] [--regions r1,r2] [--yes] [--print]" "  --doors    수집할 문(기본: 전부)" "  --regions  보안 그룹·인터페이스를 볼 리전(기본: 활성 리전 전부)" "  --yes      계정 확인과 마지막 삭제 질문을 건너뜁니다" "  --print    결과 JSON을 화면(표준 출력)에도 냅니다"; exit 0 ;;
      *) die 2 "알 수 없는 인자: $1 (--help 참고)" ;;
    esac
    shift
  done
  if [[ ! $DOORS =~ ^$dr(,$dr)*$ ]]; then die 2 "--doors 값은 mfa,key,net,sto,log 중 쉼표로 이어서 적습니다."; fi
  if [ -n "$REGIONS_REQ" ] && [[ ! $REGIONS_REQ =~ ^$rr(,$rr)*$ ]]; then die 2 "--regions 값이 리전 이름 형식이 아닙니다."; fi
}
# 도구 버전과 이 파일의 해시를 기록한다(버전 확인용이며 보안 증거가 아니다)
tools() {
  local h
  if aws --version >"$TMP/ver" 2>&1 && read -r CLI_VER <"$TMP/ver"; then CLI_VER=${CLI_VER%% *}; fi
  JQ_VER=$(jq --version)
  if h=$(sha256sum "$0" 2>"$TMP/w"); then SELF_SHA=${h:0:64}; elif h=$(shasum -a 256 "$0" 2>"$TMP/w"); then SELF_SHA=${h:0:64}; fi
}

# @cc:section identity — 신원: 누구의 어느 계정으로 실행 중인지 보여 주고 확인받는다
identity() {
  # @cc:identity.caller 호출 주체의 계정 ID와 유형(세션 이름·사용자 ID는 버린다)
  call sts:GetCallerIdentity global - - '([.Arn | capture("^arn:(?<p>aws[a-z-]*):(?:iam|sts)::(?<a>[0-9]{12}):(?<r>.+)$")] | .[0]) as $m | {accountId: .Account, partition: $m.p, principalType: (if $m.r == "root" then "root" elif ($m.r | startswith("user/")) then "user" elif ($m.r | startswith("assumed-role/")) then "assumed-role" elif ($m.r | startswith("federated-user/")) then "federated-user" else "unknown" end), principalName: (if ($m.r | startswith("user/")) then ($m.r | split("/") | last | .[0:128]) elif ($m.r | startswith("assumed-role/")) then ($m.r | split("/") | .[1] | .[0:128]) else null end)}' -- aws sts get-caller-identity --output json
  if [ "$RESULT" != ok ]; then die 4 "신원을 확인하지 못했습니다($CODE). 아무것도 수집하지 않고 끝냅니다."; fi
  keep id
  ACCT=$(jq -r '.value.accountId // ""' "$TMP/id")
  if [[ ! "$ACCT:$(jq -r '.value.partition // ""' "$TMP/id")" =~ ^[0-9]{12}:aws$ ]]; then die 4 "AWS 상용 파티션의 계정만 지원합니다. 아무것도 수집하지 않고 끝냅니다."; fi
  # @cc:identity.alias 계정 별칭(없으면 빈 값 · 화면 표시 확인용)
  call iam:ListAccountAliases global - .AccountAliases '.AccountAliases[0]' -- aws iam list-account-aliases --output json
  keep alias
  jq -r --slurpfile a "$TMP/alias" '.value | "계정 ID   : \(.accountId)\n계정 별칭  : \($a[0].value | @json)\n실행 주체  : \(.principalType) \(.principalName | @json)" + (if .principalType == "root" then "\n경고: 루트 자격증명으로 실행 중입니다." else "" end)' "$TMP/id" >&2
}
# C-05 계정 확인: 대화형이면 Enter를 기다리고, 아니면 --yes가 있어야 진행한다
confirm() {
  if [ "$YES" = 1 ]; then CONFIRMED=flag-yes; return 0; fi
  if [ -t 0 ]; then read -r -p "이 계정이 맞으면 Enter, 아니면 Ctrl+C: " _; CONFIRMED=interactive; return 0; fi
  die 3 "대화형 터미널이 아니면 --yes가 필요합니다. 아무것도 수집하지 않고 끝냅니다."
}

# @cc:section scope — 범위: 활성 리전 목록(보안 그룹·인터페이스를 볼 리전)
scope() {
  # @cc:scope.regions 활성 리전 목록(--regions를 주면 그 목록만 본다)
  call ec2:DescribeRegions global - .Regions '[.Regions[].RegionName] | sort' -- aws ec2 describe-regions --output json
  keep regions
  jq -nr --arg req "$REGIONS_REQ" --arg cur "${AWS_REGION:-${AWS_DEFAULT_REGION:-}}" --slurpfile v "$TMP/regions" '($req | split(",") | map(select(test("^[a-z]{2}(-[a-z]+)+-[0-9]{1,2}$")))) as $r | (if ($r | length) > 0 then $r elif $v[0].value != null then $v[0].value elif ($cur | test("^[a-z]{2}(-[a-z]+)+-[0-9]{1,2}$")) then [$cur] else [] end) | .[]' >"$TMP/regions.txt"
}

# @cc:section mfa-key — 현관·열쇠: 자격증명 보고서, 계정 요약, 사용자별 조회(키·MFA·정책·그룹), 역할
door_iam() {
  local i=0 u g gen
  while [ "$i" -lt 10 ]; do
    # @cc:mfa.report-gen 보고서 생성 요청(유일한 비조회 호출 · 4시간 안의 보고서가 있으면 그대로 돌려준다)
    call iam:GenerateCredentialReport global - - '{state: .State}' -- aws iam generate-credential-report --output json
    if [ "$RESULT" != ok ]; then break; fi
    if [ "$(jq -r '.state' "$TMP/v")" = COMPLETE ]; then break; fi
    sleep 2; i=$((i + 1))
  done
  gen=$LAST_ID
  # @cc:mfa.report-get 자격증명 보고서 받기(Content는 Base64 · 열 이름을 기준으로 페이지가 읽는다)
  call iam:GetCredentialReport global - - '{generatedTime: .GeneratedTime, format: .ReportFormat, csv: (.Content | @base64d)}' -- aws iam get-credential-report --output json
  jq -c --arg g "$gen" '. + {generateReceipt: $g}' "$TMP/val" >"$TMP/cr"; put credentialReport cr
  # @cc:mfa.summary 계정 요약: 루트 MFA·루트 키 수와 사용자 수(보고서와 교차 확인용)
  call iam:GetAccountSummary global - - '.SummaryMap | {Users, Groups, Roles, AccountMFAEnabled, AccountAccessKeysPresent, AccountSigningCertificatesPresent, MFADevicesInUse} | with_entries(select(.value != null))' -- aws iam get-account-summary --output json
  put accountSummary
  # @cc:mfa.users 사용자 목록(이름·생성일·마지막 로그인만 · 이름순)
  call iam:ListUsers global - .Users '[.Users[] | {userName: .UserName, createDate: .CreateDate, passwordLastUsed: (.PasswordLastUsed // null)}] | sort_by(.userName)' -- aws iam list-users --output json
  keep lu; LU=$LAST_ID
  jq -r --argjson lim "$LIM_USERS" '(.value // [])[0:$lim][].userName' "$TMP/lu" >"$TMP/users.txt"
  say "  사용자 $(jq -r '(.value // []) | length' "$TMP/lu")명 중 최대 $LIM_USERS명의 세부 정보를 읽습니다"
  while IFS= read -r u; do
    # @cc:key.keys 액세스 키의 상태·생성일·ID 끝 4자리(전체 ID는 이 프로세스 밖으로 나가지 않는다)
    slot key u.ak iam:ListAccessKeys global "$u" .AccessKeyMetadata '[.AccessKeyMetadata[] | {status: .Status, createDate: .CreateDate, idSuffix: (.AccessKeyId | .[-4:])}]' -- aws iam list-access-keys --user-name "$u" --output json
    # @cc:mfa.devices MFA 장치 개수(일련번호는 읽지 않는다)
    slot mfa u.mf iam:ListMFADevices global "$u" .MFADevices '{count: (.MFADevices | length)}' -- aws iam list-mfa-devices --user-name "$u" --output json
    # @cc:key.user-policies 사용자에게 직접 붙은 관리형 정책 ARN
    slot key u.ap iam:ListAttachedUserPolicies global "$u" .AttachedPolicies '[.AttachedPolicies[].PolicyArn]' -- aws iam list-attached-user-policies --user-name "$u" --output json
    # @cc:key.user-groups 사용자가 속한 그룹 이름
    slot key u.gr iam:ListGroupsForUser global "$u" .Groups '[.Groups[].GroupName]' -- aws iam list-groups-for-user --user-name "$u" --output json
  done <"$TMP/users.txt"
  jq -c --argjson lim "$LIM_USERS" --slurpfile ak "$TMP/u.ak" --slurpfile mf "$TMP/u.mf" --slurpfile ap "$TMP/u.ap" --slurpfile gr "$TMP/u.gr" '.receipt as $lr | (.value // []) as $it | ([($it | length), $lim] | min) as $n | {receipt: $lr, budget: {limit: $lim, total: ($it | length), collected: $n}, items: (if .value == null then null else [range(0; $it | length) as $i | $it[$i] + (if $i < $n then {accessKeys: $ak[$i], mfaDevices: $mf[$i], attachedPolicyArns: $ap[$i], groupNames: $gr[$i]} else {accessKeys: {receipt: $lr, value: null}, mfaDevices: {receipt: $lr, value: null}, attachedPolicyArns: {receipt: $lr, value: null}, groupNames: {receipt: $lr, value: null}} end)] end)}' "$TMP/lu" >"$TMP/iu"; put iamUsers iu
  if want key; then
    jq -rs '[.[] | .value // empty | .[]] | unique | .[]' "$TMP/u.gr" >"$TMP/groups.txt"
    while IFS= read -r g; do
      # @cc:key.group-policies 그룹에 붙은 관리형 정책 ARN
      call iam:ListAttachedGroupPolicies global "$g" .AttachedPolicies '[.AttachedPolicies[].PolicyArn]' -- aws iam list-attached-group-policies --group-name "$g" --output json
      jq -c --arg g "$g" '{groupName: $g, attachedPolicyArns: .}' "$TMP/val" >>"$TMP/g.l"
    done <"$TMP/groups.txt"
    putl iamGroups g.l
    # @cc:key.roles 역할 이름·경로·신뢰 정책의 주체와 조건 키 이름(정책 전문·조건 값·권한 정책은 읽지 않는다)
    call iam:ListRoles global - .Roles 'def arr: if type == "array" then . elif . == null then [] else [.] end; [.Roles[] | {roleName: .RoleName, path: .Path, createDate: .CreateDate, trust: (.AssumeRolePolicyDocument.Statement as $s | if ($s | type) == "array" then ($s | map({effect: (.Effect // "" | tostring | .[0:16]), actions: (.Action | arr | map(tostring | .[0:128])), notPrincipal: has("NotPrincipal"), principal: ((.Principal // {}) as $p | (if ($p | type) == "string" then {AWS: [$p]} else $p end) as $q | {wildcard: ($q.AWS | arr | any(. == "*")), aws: ($q.AWS | arr | map(tostring | .[0:2048])), service: ($q.Service | arr | map(tostring | .[0:256])), federated: ($q.Federated | arr | map(tostring | .[0:2048])), canonicalUserCount: ($q.CanonicalUser | arr | length)}), conditionKeys: [(.Condition // {}) | to_entries[] | .key as $op | (.value | keys[]) | "\($op):\(.)" | .[0:256]]})) else null end)}] | sort_by(.roleName)' -- aws iam list-roles --output json
    put iamRoles
  fi
}

# @cc:section net — 창문: 리전마다 보안 그룹(인바운드)과 네트워크 인터페이스(공인 IP 유무만)
door_net() {
  local r
  while IFS= read -r r; do
    # @cc:net.security-groups 보안 그룹 인바운드 규칙(규칙 설명·태그·아웃바운드는 읽지 않는다)
    call ec2:DescribeSecurityGroups "$r" - .SecurityGroups '[.SecurityGroups[] | {groupId: .GroupId, groupName: .GroupName, vpcId: (.VpcId // null), ingress: [.IpPermissions[]? | {protocol: .IpProtocol, fromPort: (.FromPort // null), toPort: (.ToPort // null), cidrs: [.IpRanges[]?.CidrIp], ipv6Cidrs: [.Ipv6Ranges[]?.CidrIpv6], prefixListIds: [.PrefixListIds[]?.PrefixListId], sgRefCount: ((.UserIdGroupPairs // []) | length)}]}]' -- aws ec2 describe-security-groups --region "$r" --output json
    jq -c --arg r "$r" '{region: $r, receipt: .receipt, items: .value}' "$TMP/val" >>"$TMP/sg"
    # @cc:net.interfaces 네트워크 인터페이스: 공인 IP·IPv6가 있는지만(주소 값은 버린다)
    call ec2:DescribeNetworkInterfaces "$r" - .NetworkInterfaces '[.NetworkInterfaces[] | {eniId: .NetworkInterfaceId, groupIds: [.Groups[]?.GroupId], hasPublicIp: (((.Association.PublicIp // null) != null) or (([.PrivateIpAddresses[]? | .Association.PublicIp // empty] | length) > 0)), hasIpv6: ((.Ipv6Addresses // []) | length > 0), interfaceType: (.InterfaceType // null), status: (.Status // null), requesterManaged: (.RequesterManaged // false)}]' -- aws ec2 describe-network-interfaces --region "$r" --output json
    jq -c --arg r "$r" '{region: $r, receipt: .receipt, items: .value}' "$TMP/val" >>"$TMP/eni"
  done <"$TMP/regions.txt"
  putl securityGroups sg; putl networkInterfaces eni
}

# @cc:section sto — 창고: 계정·버킷의 공개 설정(정책 전문·객체 키는 읽지 않는다)
door_sto() {
  local b br
  # @cc:sto.account-block 계정 전체 퍼블릭 액세스 차단 4개 설정('설정 없음' 오류도 유효한 답이다)
  call s3:GetAccountPublicAccessBlock global - - '.PublicAccessBlockConfiguration | {blockPublicAcls: .BlockPublicAcls, ignorePublicAcls: .IgnorePublicAcls, blockPublicPolicy: .BlockPublicPolicy, restrictPublicBuckets: .RestrictPublicBuckets}' -- aws s3control get-public-access-block --account-id "$ACCT" --output json
  put accountPublicAccessBlock
  # @cc:sto.buckets 버킷 목록(이름·생성일·리전만 · 이름순)
  call s3:ListAllMyBuckets global - .Buckets '[.Buckets[]? | {name: .Name, createDate: (.CreationDate // null), region: (.BucketRegion // null)}] | sort_by(.name)' -- aws s3api list-buckets --output json
  keep lb; LB=$LAST_ID
  jq -r --argjson lim "$LIM_BUCKETS" '(.value // [])[0:$lim][] | "\(.name)|\(.region // "")"' "$TMP/lb" >"$TMP/buckets.txt"
  say "  버킷 $(jq -r '(.value // []) | length' "$TMP/lb")개 중 최대 $LIM_BUCKETS개의 세부 설정을 읽습니다"
  while IFS='|' read -r b br; do
    if [ -n "$br" ]; then jq -nc --arg v "$br" '{receipt: null, value: {region: $v}}' >>"$TMP/b.rg"
    else
      # @cc:sto.location 버킷 리전(목록에 리전이 없을 때만 · 값이 없으면 us-east-1, EU는 eu-west-1)
      ACC=b.rg call s3:GetBucketLocation global "$b" - '{region: (.LocationConstraint | if . == null or . == "" then "us-east-1" elif . == "EU" then "eu-west-1" else . end)}' -- aws s3api get-bucket-location --bucket "$b" --output json
      br=$(jq -r '.value.region // ""' "$TMP/val")
    fi
    # @cc:sto.bucket-block 버킷 퍼블릭 액세스 차단 설정
    ACC=b.pb call s3:GetBucketPublicAccessBlock "${br:-us-east-1}" "$b" - '.PublicAccessBlockConfiguration | {blockPublicAcls: .BlockPublicAcls, ignorePublicAcls: .IgnorePublicAcls, blockPublicPolicy: .BlockPublicPolicy, restrictPublicBuckets: .RestrictPublicBuckets}' -- aws s3api get-public-access-block --bucket "$b" --region "${br:-us-east-1}" --output json
    # @cc:sto.bucket-policy 버킷 정책이 공개인지(IsPublic만 · 정책 전문은 읽지 않는다)
    ACC=b.ps call s3:GetBucketPolicyStatus "${br:-us-east-1}" "$b" - '.PolicyStatus.IsPublic | if type == "boolean" then {isPublic: .} else error("isPublic") end' -- aws s3api get-bucket-policy-status --bucket "$b" --region "${br:-us-east-1}" --output json
    # @cc:sto.bucket-acl ACL에서 모든 사용자·AWS 계정이 있는 모든 사용자에게 준 권한만(소유자 ID·표시 이름은 버린다)
    ACC=b.ac call s3:GetBucketAcl "${br:-us-east-1}" "$b" - '{publicGrants: [.Grants[]? | select((.Grantee.URI // "") | test("/global/(AllUsers|AuthenticatedUsers)$")) | {grantee: (.Grantee.URI | split("/") | last), permission: .Permission}]}' -- aws s3api get-bucket-acl --bucket "$b" --region "${br:-us-east-1}" --output json
    # @cc:sto.bucket-ownership 객체 소유권 설정(ACL 사용 여부 판단용)
    ACC=b.ow call s3:GetBucketOwnershipControls "${br:-us-east-1}" "$b" - '{objectOwnership: (.OwnershipControls.Rules[0].ObjectOwnership // "")}' -- aws s3api get-bucket-ownership-controls --bucket "$b" --region "${br:-us-east-1}" --output json
    # @cc:sto.bucket-website 정적 웹사이트 호스팅이 켜져 있는지(문서 이름은 버린다)
    ACC=b.ws call s3:GetBucketWebsite "${br:-us-east-1}" "$b" - '{enabled: true}' -- aws s3api get-bucket-website --bucket "$b" --region "${br:-us-east-1}" --output json
  done <"$TMP/buckets.txt"
  jq -c --argjson lim "$LIM_BUCKETS" --slurpfile rg "$TMP/b.rg" --slurpfile pb "$TMP/b.pb" --slurpfile ps "$TMP/b.ps" --slurpfile ac "$TMP/b.ac" --slurpfile ow "$TMP/b.ow" --slurpfile ws "$TMP/b.ws" '.receipt as $lr | (.value // []) as $it | ([($it | length), $lim] | min) as $n | {receipt: $lr, budget: {limit: $lim, total: ($it | length), collected: $n}, items: (if .value == null then null else [range(0; $it | length) as $i | {name: $it[$i].name, createDate: $it[$i].createDate} + (if $i < $n then {region: {value: ($rg[$i].value.region // null), source: (if $rg[$i].receipt == null then "list" else "location" end), receipt: $rg[$i].receipt}, publicAccessBlock: $pb[$i], policyStatus: $ps[$i], acl: $ac[$i], ownership: $ow[$i], website: $ws[$i]} else {region: {value: $it[$i].region, source: "list", receipt: null}, publicAccessBlock: {receipt: $lr, value: null}, policyStatus: {receipt: $lr, value: null}, acl: {receipt: $lr, value: null}, ownership: {receipt: $lr, value: null}, website: {receipt: $lr, value: null}} end)] end)}' "$TMP/lb" >"$TMP/bk"; put buckets bk
}

# @cc:section log — CCTV: CloudTrail trail 구성(기록 켜짐 여부와 이벤트 선택기)
door_log() {
  local t hr
  # @cc:log.trails trail 목록(이름·ARN·홈 리전·설정 플래그만 · ARN순)
  call cloudtrail:DescribeTrails global - .trailList '[.trailList[] | {name: .Name, trailArn: .TrailARN, homeRegion: .HomeRegion, isMultiRegion: (.IsMultiRegionTrail // false), isOrganizationTrail: (.IsOrganizationTrail // false), logFileValidationEnabled: (.LogFileValidationEnabled // false), hasCloudWatchLogs: ((.CloudWatchLogsLogGroupArn // null) != null), hasCustomEventSelectors: (.HasCustomEventSelectors // false)}] | sort_by(.trailArn)' -- aws cloudtrail describe-trails --output json
  keep tl
  jq -r '(.value // [])[] | "\(.trailArn)|\(.homeRegion)"' "$TMP/tl" >"$TMP/trails.txt"
  while IFS='|' read -r t hr; do
    # @cc:log.status trail 상태: 기록 중인지, 최근 전송 오류가 있는지만
    ACC=t.st call cloudtrail:GetTrailStatus "$hr" "$t" - '{isLogging: (.IsLogging // false), hasDeliveryError: (((.LatestDeliveryError // "") | tostring | length) > 0)}' -- aws cloudtrail get-trail-status --name "$t" --region "$hr" --output json
    # @cc:log.selectors 이벤트 선택기: 기본 선택기와 고급 선택기의 eventCategory·readOnly 필드만(Equals만 값으로 싣고, 다른 연산자가 섞인 필드는 빈 목록으로 표시)
    ACC=t.se call cloudtrail:GetEventSelectors "$hr" "$t" - '{basic: [(.EventSelectors // [])[] | {readWriteType: (.ReadWriteType // "" | .[0:16]), includeManagementEvents: (.IncludeManagementEvents // false)}], advanced: [(.AdvancedEventSelectors // [])[] | {fields: [(.FieldSelectors // [])[] | select(.Field == "eventCategory" or .Field == "readOnly") | {field: .Field, equals: (if ([.NotEquals, .StartsWith, .EndsWith, .NotStartsWith, .NotEndsWith] | map(select(. != null and . != [])) | length) > 0 then [] else [(.Equals // [])[] | tostring | .[0:64]] end)}]}]}' -- aws cloudtrail get-event-selectors --trail-name "$t" --region "$hr" --output json
  done <"$TMP/trails.txt"
  jq -c --slurpfile st "$TMP/t.st" --slurpfile se "$TMP/t.se" '{receipt: .receipt, value: (if .value == null then null else [range(0; .value | length) as $i | .value[$i] + {status: $st[$i], selectors: $se[$i]}] end)}' "$TMP/tl" >"$TMP/tv"; put trails tv
}

# @cc:section assemble — 조립: 조각을 합쳐 결과 파일 1개를 만들고, 필요하면 화면에 출력한다
finish() {
  local out="cloudcheck-aws-${ACCT: -4}-$(date -u +%Y%m%dT%H%M%SZ).json"
  OUT_TMP=$(mktemp "$out.XXXXXX")
  jq -sc 'add' "$TMP"/p.* >"$TMP/data"
  jq -nc --arg schema "$CC_SCHEMA" --arg name "$CC_NAME" --arg ver "$CC_VERSION" --arg sha "$SELF_SHA" --arg cli "$CLI_VER" --arg jqv "$JQ_VER" --arg bv "$BASH_VERSION" --arg t0 "$T0" --arg t1 "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg conf "$CONFIRMED" --arg doors "$DOORS" --slurpfile id "$TMP/id" --slurpfile al "$TMP/alias" --slurpfile rg "$TMP/regions" --arg req "$REGIONS_REQ" --slurpfile rc "$TMP/receipts" --slurpfile data "$TMP/data" '($doors | split(",")) as $d | def st($x): if ([$d[] | select(. == $x)] | length) > 0 then "collected" else "skipped" end; {schema: $schema, collector: {name: $name, version: $ver, sha256: (if $sha == "" then null else $sha end), tools: {cli: (if $cli == "" then null else $cli[0:64] end), jq: (if $jqv == "" then null else $jqv[0:32] end), bash: $bv[0:32]}}, cloud: "aws", collectedAt: $t0, run: {finishedAt: $t1, confirmed: $conf, doors: {mfa: st("mfa"), key: st("key"), net: st("net"), sto: st("sto"), log: st("log")}}, identity: ({receipt: $id[0].receipt} + $id[0].value + {alias: $al[0]}), scope: {regions: $rg[0], regionsRequested: (if $req == "" then null else ($req | split(",")) end)}, receipts: $rc, data: $data[0]}' >"$OUT_TMP"
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
  for f in empty receipts u.ak u.mf u.ap u.gr g.l sg eni b.rg b.pb b.ps b.ac b.ow b.ws t.st t.se; do : >"$TMP/$f"; done
  parse_args "$@"
  need jq; need aws; tools
  say "문단속 5 수집기(AWS) $CC_VERSION — 읽기 전용 호출만 사용합니다"
  identity; confirm
  T0=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  scope
  if want mfa key; then say "[현관·열쇠] IAM 정보를 읽습니다"; door_iam; fi
  if want net; then say "[창문] 리전별 네트워크 설정을 읽습니다"; door_net; fi
  if want sto; then say "[창고] 계정과 버킷의 공개 설정을 읽습니다"; door_sto; fi
  if want log; then say "[CCTV] CloudTrail 설정을 읽습니다"; door_log; fi
  finish
}

main "$@"
