#!/usr/bin/env bash
#
# convert.sh — HWP / HWPX → PDF  (LibreOffice headless + H2Orestart)
#
# Usage:
#   convert.sh <input.hwp|input.hwpx> [output_dir]
#
# Env overrides:
#   CONVERT_TIMEOUT   변환 타임아웃 초 (기본 60)
#   SOFFICE_BIN       soffice 실행 경로 (미지정 시 자동 탐색)
#
# Exit codes (실패 유형을 명확히 구분 — 품질 로깅용):
#   0  성공
#   1  사용법/인자 오류
#   2  입력 파일 없음
#   3  지원하지 않는 확장자
#   4  변환 타임아웃 (LibreOffice 행)
#   5  변환 실패 (soffice 에러 또는 PDF 미생성)
#
set -uo pipefail

TIMEOUT="${CONVERT_TIMEOUT:-60}"

log() { printf '[convert] %s\n' "$*" >&2; }

# ── 1. 인자 검증 ──────────────────────────────────────────────
if [ "$#" -lt 1 ]; then
  log "usage: convert.sh <input.hwp|input.hwpx> [output_dir]"
  exit 1
fi
INPUT="$1"
OUTDIR="${2:-$(dirname "$INPUT")}"

if [ ! -f "$INPUT" ]; then
  log "input not found: $INPUT"
  exit 2
fi

ext="$(printf '%s' "${INPUT##*.}" | tr '[:upper:]' '[:lower:]')"
case "$ext" in
  hwp|hwpx) ;;
  *) log "unsupported extension: .$ext (hwp/hwpx only)"; exit 3 ;;
esac

mkdir -p "$OUTDIR"

# ── 2. soffice 바이너리 탐색 (mac/linux) ──────────────────────
SOFFICE="${SOFFICE_BIN:-}"
if [ -z "$SOFFICE" ]; then
  if command -v soffice >/dev/null 2>&1; then
    SOFFICE="$(command -v soffice)"
  elif [ -x /Applications/LibreOffice.app/Contents/MacOS/soffice ]; then
    SOFFICE=/Applications/LibreOffice.app/Contents/MacOS/soffice
  else
    log "soffice not found (set SOFFICE_BIN)"; exit 5
  fi
fi

# ── 3. 프로파일 선택 ──────────────────────────────────────────
#   LO_USER_PROFILE 지정 → 그 영속 프로파일 재사용 (확장이 설치된 곳; 로컬 맥)
#   미지정 → 1회용 temp 프로파일 (Docker의 --shared 확장 전제, 동시 실행 안전)
if [ -n "${LO_USER_PROFILE:-}" ]; then
  LO_PROFILE="$LO_USER_PROFILE"; PERSISTENT=1; mkdir -p "$LO_PROFILE"
else
  LO_PROFILE="$(mktemp -d "${TMPDIR:-/tmp}/lo_profile.XXXXXX")"; PERSISTENT=0
fi
cleanup() {
  # 이 프로파일을 쓰는 잔여 soffice 프로세스만 정밀 종료 (좀비 방지)
  pkill -f "$LO_PROFILE" 2>/dev/null || true
  sleep 0.3
  pkill -9 -f "$LO_PROFILE" 2>/dev/null || true
  [ "$PERSISTENT" -eq 0 ] && rm -rf "$LO_PROFILE" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── 4. 타임아웃 래퍼 (timeout/gtimeout 없으면 워치독 폴백) ──────
run_with_timeout() {
  local secs="$1"; shift
  if command -v timeout >/dev/null 2>&1; then
    timeout -k 5 "$secs" "$@"; return $?
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout -k 5 "$secs" "$@"; return $?
  fi
  "$@" &
  local pid=$!
  ( sleep "$secs"; kill -TERM "$pid" 2>/dev/null; sleep 5; kill -KILL "$pid" 2>/dev/null ) &
  local watcher=$!
  wait "$pid" 2>/dev/null; local rc=$?
  kill "$watcher" 2>/dev/null || true
  # 워치독에 죽었으면 타임아웃(124)로 정규화
  if [ "$rc" -ge 128 ]; then return 124; fi
  return "$rc"
}

# ── 5. 변환 실행 ──────────────────────────────────────────────
base="$(basename "$INPUT")"
expected="$OUTDIR/${base%.*}.pdf"
rm -f "$expected" 2>/dev/null || true

log "converting: $base  (timeout ${TIMEOUT}s)"
start=$(date +%s)

run_with_timeout "$TIMEOUT" "$SOFFICE" \
  -env:UserInstallation="file://$LO_PROFILE" \
  --headless --norestore --nolockcheck --nodefault --nofirststartwizard \
  --convert-to pdf:writer_pdf_Export \
  --outdir "$OUTDIR" "$INPUT" >&2
rc=$?

elapsed=$(( $(date +%s) - start ))

# ── 6. 결과 판정 ──────────────────────────────────────────────
if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
  log "TIMEOUT after ${TIMEOUT}s"
  exit 4
fi
if [ "$rc" -ne 0 ]; then
  log "soffice exited with code $rc"
  exit 5
fi
if [ ! -s "$expected" ]; then
  log "no PDF produced (expected: $expected)"
  exit 5
fi

log "OK -> $expected  (${elapsed}s, $(du -h "$expected" | cut -f1))"
printf '%s\n' "$expected"   # stdout = 결과 경로 (스크립트 연동용)
exit 0
