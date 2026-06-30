"""
converter.py — HWP/HWPX → PDF 변환 코어 (동시 변환 큐 + 바운드 워커 풀)

1단계 산출물이자 2단계 FastAPI가 그대로 재사용하는 공용 모듈.

설계 핵심:
  - LibreOffice headless는 동시 실행에 취약 → asyncio.Semaphore로 동시성 상한을 둔다.
  - 변환 자체는 검증된 convert.sh에 위임(타임아웃·좀비킬·프로파일 격리 로직 재사용).
  - 각 작업은 고유 temp 디렉터리에서 처리하고, 끝나면 즉시 삭제한다("서버 미저장" 신뢰 정책).
  - convert.sh는 결과 PDF 경로를 stdout 마지막 줄로 출력하고, 실패 유형을 exit code(1~5)로 구분한다.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

# ── 설정 (환경변수로 오버라이드 가능) ─────────────────────────────
CONVERT_SH = os.environ.get("CONVERT_SH", "/usr/local/bin/convert.sh")
MAX_CONCURRENCY = int(os.environ.get("MAX_CONCURRENCY", "2"))   # LO 동시 실행 상한
CONVERT_TIMEOUT = int(os.environ.get("CONVERT_TIMEOUT", "60"))  # 초 (convert.sh로 전달)
MAX_SIZE_BYTES = int(os.environ.get("MAX_SIZE_BYTES", str(20 * 1024 * 1024)))  # 20MB
WORK_ROOT = Path(os.environ.get("WORK_ROOT", "/tmp/hwp2pdf"))

ALLOWED_EXTS = ("hwp", "hwpx")

# convert.sh exit code → 의미 (실패 유형 로깅용)
_CODE_MEANING = {
    1: "usage_error",
    2: "input_not_found",
    3: "unsupported_extension",
    4: "timeout",
    5: "convert_failed",
}

# 코어 자체에서 거르는 추가 코드
_CODE_TOO_LARGE = 6
_CODE_EMPTY = 7


class ConversionError(Exception):
    """변환 실패. code는 convert.sh exit code 또는 코어 자체 코드(6,7)."""

    def __init__(self, code: int, reason: str, detail: str = ""):
        self.code = code
        self.reason = reason
        self.detail = detail
        super().__init__(f"[{code}/{reason}] {detail}".strip())


@dataclass
class ConversionResult:
    pdf_bytes: bytes
    elapsed_ms: int
    source_ext: str


# Semaphore는 실행 중인 이벤트 루프에 묶여야 하므로 지연 생성한다.
_semaphore: asyncio.Semaphore | None = None
_sem_lock = asyncio.Lock()


async def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        async with _sem_lock:
            if _semaphore is None:
                _semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    return _semaphore


def _validate(filename: str, size: int) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTS:
        raise ConversionError(3, "unsupported_extension", f".{ext} (hwp/hwpx만 지원)")
    if size <= 0:
        raise ConversionError(_CODE_EMPTY, "empty_file", "빈 파일")
    if size > MAX_SIZE_BYTES:
        raise ConversionError(_CODE_TOO_LARGE, "too_large",
                              f"{size} bytes > 한도 {MAX_SIZE_BYTES}")
    return ext


async def convert_bytes(data: bytes, filename: str) -> ConversionResult:
    """업로드 바이트를 PDF 바이트로 변환. 작업 디렉터리는 끝나면 즉시 삭제."""
    ext = _validate(filename, len(data))

    job_id = uuid.uuid4().hex
    job_dir = WORK_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    in_path = job_dir / f"input.{ext}"

    loop = asyncio.get_running_loop()
    start = loop.time()
    try:
        in_path.write_bytes(data)

        sem = await _get_semaphore()
        async with sem:  # ← 동시 실행 상한
            proc = await asyncio.create_subprocess_exec(
                CONVERT_SH, str(in_path), str(job_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, "CONVERT_TIMEOUT": str(CONVERT_TIMEOUT)},
            )
            out, err = await proc.communicate()
            rc = proc.returncode

        if rc != 0:
            reason = _CODE_MEANING.get(rc, "unknown")
            tail = err.decode("utf-8", "replace").strip().splitlines()[-3:]
            raise ConversionError(rc, reason, " / ".join(tail))

        # stdout 마지막 줄 = PDF 경로. 누락 시 관례적 경로로 폴백.
        pdf_path = None
        for line in reversed(out.decode("utf-8", "replace").splitlines()):
            line = line.strip()
            if line.endswith(".pdf"):
                pdf_path = Path(line)
                break
        if pdf_path is None or not pdf_path.is_file():
            pdf_path = job_dir / "input.pdf"
        if not pdf_path.is_file() or pdf_path.stat().st_size == 0:
            raise ConversionError(5, "convert_failed", "PDF 미생성")

        pdf_bytes = pdf_path.read_bytes()
        elapsed_ms = int((loop.time() - start) * 1000)
        return ConversionResult(pdf_bytes=pdf_bytes, elapsed_ms=elapsed_ms, source_ext=ext)
    finally:
        # 즉시 삭제 — 입력/출력 모두 서버에 남기지 않는다.
        shutil.rmtree(job_dir, ignore_errors=True)
