#!/bin/bash
# 가짜 aws / az — PATH 맨 앞에 끼워 넣어 시나리오 파일의 응답을 돌려준다(테스트 전용 · 실제 클라우드를 부르지 않는다).
# 같은 파일을 aws, az 두 이름으로 복사해 쓴다. 시나리오 키: "<명령 토큰들>" + "#<리소스>" + "@<리전 또는 구독>".
# 시나리오에 없는 호출은 종료 코드 99와 UNEXPECTED CALL을 돌려주고 로그에 남긴다(테스트가 실패로 잡는다).
tool=${0##*/}
{ printf '%s' "$tool"; for a in "$@"; do printf '\037%s' "$a"; done; printf '\n'; } >>"$CC_SHIM_LOG"
# 엔드포인트 고정(백엔드팀장 STEP 4): 수집기가 AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true를 내보내지 않았으면 어떤 aws 호출에도 답하지 않는다
if [ "$tool" = aws ] && [ "${AWS_IGNORE_CONFIGURED_ENDPOINT_URLS:-}" != true ]; then
  printf '!UNEXPECTED\t%s\n' "endpoint-guard-missing" >>"$CC_SHIM_LOG"
  echo "ENDPOINT GUARD MISSING" >&2
  exit 99
fi
if [ "${1:-}" = "--version" ]; then
  if [ "$tool" = aws ]; then echo "aws-cli/2.17.0 Python/3.11.8 Darwin/25.0.0 source/arm64"; else echo "azure-cli 2.60.0"; fi
  exit 0
fi
# az version: 설치된 버전만 JSON으로(로컬 조회 · 시나리오 밖이어도 응답한다)
if [ "$tool" = az ] && [ "${1:-}" = "version" ]; then
  echo '{"azure-cli": "2.60.0", "azure-cli-core": "2.60.0", "azure-cli-telemetry": "1.1.0", "extensions": {}}'
  exit 0
fi
base="" res="" reg=""
if [ "$tool" = aws ]; then
  base="${1:-} ${2:-}"; shift 2 2>/dev/null
else
  while [ $# -gt 0 ] && [ "${1#-}" = "$1" ]; do base="${base:+$base }$1"; shift; done
fi
while [ $# -gt 0 ]; do
  case "$1" in
    --region|--subscription) reg=${2:-}; shift 2 ;;
    --user-name|--group-name|--bucket|--name|--trail-name|--account-id|--storage-account|--resource) res=${2:-}; shift 2 ;;
    *) shift ;;
  esac
done
cands="$base"
[ -n "$reg" ] && cands="$base@$reg
$cands"
[ -n "$res" ] && cands="$base#$res
$cands"
if [ -n "$res" ] && [ -n "$reg" ]; then cands="$base#$res@$reg
$cands"; fi
found=""
while IFS= read -r k; do
  f=${k//[^A-Za-z0-9._-]/_}
  if [ -f "$CC_SHIM_DIR/$f.n" ]; then found=$f; break; fi
done <<EOT
$cands
EOT
if [ -z "$found" ]; then
  printf '!UNEXPECTED\t%s#%s@%s\n' "$base" "$res" "$reg" >>"$CC_SHIM_LOG"
  echo "UNEXPECTED CALL: $base#$res@$reg" >&2
  exit 99
fi
n=$(cat "$CC_SHIM_DIR/$found.n")
c=0; [ -f "$CC_SHIM_DIR/$found.c" ] && c=$(cat "$CC_SHIM_DIR/$found.c")
idx=$c; [ "$idx" -ge "$n" ] && idx=$((n - 1))
echo $((c + 1)) >"$CC_SHIM_DIR/$found.c"
cat "$CC_SHIM_DIR/$found.$idx.out"
cat "$CC_SHIM_DIR/$found.$idx.err" >&2
exit "$(cat "$CC_SHIM_DIR/$found.$idx.rc")"
