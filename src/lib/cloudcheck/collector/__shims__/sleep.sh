#!/bin/bash
# 즉시 반환하는 sleep — 호출 사실만 로그에 남긴다(폴링 횟수 검사용)
printf 'sleep\037%s\n' "$*" >>"$CC_SHIM_LOG"
exit 0
