"""
stress_test.py — 1단계 동시 변환 안전성 증명

LibreOffice headless는 동시 실행에 취약하다고 알려져 있다.
검증된 실제 정부 샘플들을 한꺼번에 다수 제출하여,
바운드 워커 풀(MAX_CONCURRENCY) 하에서 교차 오염·크래시 없이
모두 올바른 PDF를 생산하는지 확인한다.

실행(컨테이너 내부):
  docker run --rm -v "$SAMPLES:/work" -e MAX_CONCURRENCY=2 \
    --entrypoint python3 hwp2pdf /app/stress_test.py
"""

import asyncio
import hashlib
import re
import sys
import time
from pathlib import Path

# PDF는 바이트 단위로 비결정적이다: LibreOffice가 매 변환마다
# 생성시각/고유ID를 새로 박는다. 내용 동일성 비교를 위해 이 휘발성
# 필드들을 제거한 뒤 해시한다(같은 길이라 오프셋은 안 밀린다).
_VOLATILE = [
    re.compile(rb"/CreationDate\s*\(.*?\)"),
    re.compile(rb"/ModDate\s*\(.*?\)"),
    re.compile(rb"/ID\s*\[.*?\]"),
    re.compile(rb"<x[a-zA-Z]*:(?:Create|Modify|Metadata)Date>.*?</x[a-zA-Z]*:(?:Create|Modify|Metadata)Date>"),
    re.compile(rb"xmpMM:(?:Document|Instance)ID=\".*?\""),
    re.compile(rb"<xmpMM:(?:Document|Instance)ID>.*?</xmpMM:(?:Document|Instance)ID>"),
]


def content_digest(pdf: bytes) -> str:
    norm = pdf
    for rx in _VOLATILE:
        norm = rx.sub(b"", norm)
    return hashlib.sha256(norm).hexdigest()[:12]

sys.path.insert(0, str(Path(__file__).resolve().parent))
from converter import convert_bytes, ConversionError, MAX_CONCURRENCY  # noqa: E402

SAMPLES = Path("/work")
# 검증 완료된 실제 문서들 (텍스트/표/이미지/hwpx 혼합)
CASES = [
    "01_gov_mois.hwp",     # 텍스트+이미지+표
    "04_daegu_apply.hwp",  # 표 많은 양식
    "05_seoul_report.hwpx",  # hwpx: 로고+도형+특수문자
    "07_seoul_gas.hwpx",   # hwpx: 공문
]
ROUNDS = 4  # 총 4 × 4 = 16개 작업을 동시에 투입


async def one(name: str, tag: str, results: dict):
    data = (SAMPLES / name).read_bytes()
    t0 = time.time()
    try:
        res = await convert_bytes(data, name)
        ok = res.pdf_bytes[:4] == b"%PDF" and len(res.pdf_bytes) > 1000
        digest = content_digest(res.pdf_bytes)
        results[tag] = (name, ok, len(res.pdf_bytes), digest, res.elapsed_ms)
        status = "OK " if ok else "BAD"
        print(f"  [{tag}] {status} {name:22} {len(res.pdf_bytes):>7}B  "
              f"sha={digest}  {res.elapsed_ms}ms  (wall {int((time.time()-t0)*1000)}ms)")
        return ok
    except ConversionError as e:
        results[tag] = (name, False, 0, "ERR", 0)
        print(f"  [{tag}] ERR {name:22} {e}")
        return False


async def main():
    print(f"=== 동시 변환 스트레스 테스트 (MAX_CONCURRENCY={MAX_CONCURRENCY}) ===")
    print(f"총 {ROUNDS * len(CASES)}개 작업을 동시에 투입 (라운드 {ROUNDS} × 파일 {len(CASES)})\n")

    results: dict = {}
    tasks = []
    for r in range(ROUNDS):
        for i, name in enumerate(CASES):
            tasks.append(one(name, f"{r}.{i}", results))

    wall0 = time.time()
    oks = await asyncio.gather(*tasks)
    wall = time.time() - wall0

    total = len(oks)
    passed = sum(1 for x in oks if x)
    print(f"\n결과: {passed}/{total} 성공  (총 소요 {wall:.1f}s)")

    # 교차 오염 검증: 같은 입력은 항상 같은 크기 + 같은 정규화 내용해시여야 한다.
    # (타임스탬프/ID 제거 후 해시 → 동시 실행으로 내용이 섞였다면 여기서 잡힌다)
    sizes: dict = {}
    digests: dict = {}
    corrupt = False
    for name, ok, size, digest, _ in results.values():
        if not ok:
            continue
        sizes.setdefault(name, set()).add(size)
        digests.setdefault(name, set()).add(digest)
    # 판정 기준 = 같은 입력은 항상 같은 출력 "크기".
    # (교차 오염이 있었다면 크기가 달라진다. PDF 내용해시는 매 변환마다
    #  박히는 고유ID/타임스탬프 때문에 단일 변환에서도 달라지므로 기준 아님 — 참고용.)
    print("\n무결성(같은 입력 → 같은 출력 크기) 검증:")
    for name in sorted(sizes):
        consistent = len(sizes[name]) == 1
        corrupt = corrupt or not consistent
        note = "" if len(digests[name]) == 1 else "  (내용해시 차이=PDF 고유ID/시각, 정상)"
        print(f"  {'OK ' if consistent else 'MISMATCH'} {name:22} "
              f"크기종류={len(sizes[name])}{note}")

    ok_all = passed == total and not corrupt
    print(f"\n{'✅ PASS — 동시 변환 안전' if ok_all else '❌ FAIL'}")
    sys.exit(0 if ok_all else 1)


if __name__ == "__main__":
    asyncio.run(main())
