"""
main.py — HWP/HWPX → PDF 변환 웹서비스 (FastAPI)

엔드포인트:
  GET  /            단일 페이지(한국어, 업로드 → 변환 → 다운로드)
  GET  /en          영어 랜딩(동일 기능, 영어 우선)
  POST /api/convert 멀티파트 업로드 → PDF 바이트 반환
  GET  /healthz     헬스체크
  GET  /robots.txt  크롤러 정책
  GET  /sitemap.xml 사이트맵(SEO)

신뢰 정책: 변환 후 입력/출력 모두 즉시 삭제(converter.convert_bytes의 finally).
제한: 파일 20MB / 타임아웃 60s / 확장자 hwp·hwpx.
배포: 절대 URL이 필요한 SEO 태그는 환경변수 SITE_URL 로 주입(예: https://hwp2pdf.app).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, Response

from converter import (
    ConversionError,
    MAX_SIZE_BYTES,
    convert_bytes,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("hwp2pdf")

app = FastAPI(title="hwp2pdf", docs_url=None, redoc_url=None)

# 배포 도메인(미설정 시 상대경로로 무해하게 degrade)
SITE_URL = os.environ.get("SITE_URL", "").rstrip("/")

_TEMPLATE = (Path(__file__).resolve().parent / "index.html").read_text(encoding="utf-8")
_TEMPLATE = _TEMPLATE.replace("__SITE_URL__", SITE_URL)

# 한국어(기본) / 영어 랜딩을 같은 템플릿에서 렌더 — 단일 소스 유지.
# /en 은 언어 속성 + 핵심 SEO 메타(title/description/og)를 영어 우선으로 스왑.
_PAGE_KO = _TEMPLATE
_EN_SWAPS = [
    ('<html lang="ko">', '<html lang="en">'),
    ('<body data-lang="ko">', '<body data-lang="en">'),
    ("<title>HWP를 PDF로 변환 — 무료, 가입 없음 | HWP to PDF Converter</title>",
     "<title>HWP to PDF Converter — Free, No Sign-up | Open HWP on Mac</title>"),
    ('content="한컴오피스 없이 .hwp / .hwpx 파일을 PDF로 무료 변환. 가입 없음, 광고 없음, 변환 후 즉시 삭제. '
     'Convert Korean HWP/HWPX files to PDF online — free, no sign-up, files deleted right after."',
     'content="Convert Korean .hwp / .hwpx files to PDF online for free. No sign-up, no ads, files deleted right '
     'after conversion. Open HWP files without Hancom Office on Mac or any device."'),
    ('content="HWP를 PDF로 변환 — 무료, 가입 없음" />',
     'content="HWP to PDF Converter — free, no sign-up" />'),
]
_PAGE_EN = _TEMPLATE
for _a, _b in _EN_SWAPS:
    _PAGE_EN = _PAGE_EN.replace(_a, _b)


@app.get("/", response_class=HTMLResponse)
async def index() -> HTMLResponse:
    return HTMLResponse(_PAGE_KO)


@app.get("/en", response_class=HTMLResponse)
async def index_en() -> HTMLResponse:
    return HTMLResponse(_PAGE_EN)


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


@app.get("/robots.txt", response_class=PlainTextResponse)
async def robots() -> PlainTextResponse:
    lines = ["User-agent: *", "Allow: /", "Disallow: /api/"]
    if SITE_URL:
        lines.append(f"Sitemap: {SITE_URL}/sitemap.xml")
    return PlainTextResponse("\n".join(lines) + "\n")


@app.get("/sitemap.xml")
async def sitemap() -> Response:
    base = SITE_URL or ""
    urls = "".join(
        f"<url><loc>{base}{path}</loc>"
        f"<xhtml:link rel='alternate' hreflang='ko' href='{base}/'/>"
        f"<xhtml:link rel='alternate' hreflang='en' href='{base}/en'/>"
        f"</url>"
        for path in ("/", "/en")
    )
    xml = (
        "<?xml version='1.0' encoding='UTF-8'?>"
        "<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9' "
        "xmlns:xhtml='http://www.w3.org/1999/xhtml'>"
        f"{urls}</urlset>"
    )
    return Response(content=xml, media_type="application/xml")


@app.post("/api/convert")
async def api_convert(file: UploadFile = File(...)) -> Response:
    filename = file.filename or "upload"
    data = await file.read()

    # 빠른 사전 차단(상세 검증/변환은 converter가 수행)
    if len(data) > MAX_SIZE_BYTES:
        return JSONResponse(
            status_code=413,
            content={"code": 6, "reason": "too_large",
                     "message": f"파일이 너무 큽니다 (최대 {MAX_SIZE_BYTES // (1024*1024)}MB)"},
        )

    try:
        result = await convert_bytes(data, filename)
    except ConversionError as e:
        # 실패 유형 로깅(품질 개선용) — 파일 내용은 남기지 않는다.
        log.warning("convert fail code=%s reason=%s name=%s detail=%s",
                    e.code, e.reason, filename, e.detail[:200])
        http_status = 400 if e.code in (3, 6, 7) else 422
        msg = {
            "unsupported_extension": "hwp 또는 hwpx 파일만 변환할 수 있어요.",
            "too_large": f"파일이 너무 큽니다 (최대 {MAX_SIZE_BYTES // (1024*1024)}MB).",
            "empty_file": "빈 파일입니다.",
            "timeout": "변환이 시간 내에 끝나지 않았어요. 문서가 너무 복잡할 수 있어요.",
            "convert_failed": "이 문서는 변환에 실패했어요. 수식·특수 개체가 많은 문서일 수 있어요.",
        }.get(e.reason, "변환에 실패했어요.")
        return JSONResponse(status_code=http_status,
                            content={"code": e.code, "reason": e.reason, "message": msg})

    log.info("convert ok name=%s ext=%s bytes=%d ms=%d",
             filename, result.source_ext, len(result.pdf_bytes), result.elapsed_ms)

    stem = Path(filename).stem or "converted"
    out_name = f"{stem}.pdf"
    # 한글 파일명 안전 전송(RFC 5987)
    disposition = f"attachment; filename*=UTF-8''{quote(out_name)}"
    return Response(
        content=result.pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": disposition,
                 "X-Convert-Ms": str(result.elapsed_ms)},
    )
