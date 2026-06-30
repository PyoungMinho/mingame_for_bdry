# HWP/HWPX → PDF 변환 웹서비스 이미지
# LibreOffice headless + H2Orestart + 한국어 폰트 + FastAPI
#
#   docker build -t hwp2pdf .
#   docker run --rm -p 8000:8000 hwp2pdf                         # 웹서비스
#   docker run --rm --entrypoint python3 -v "$PWD/samples:/work" hwp2pdf /app/stress_test.py   # 동시변환 테스트
#   docker run --rm --entrypoint /usr/local/bin/convert.sh -v "$PWD/samples:/work" hwp2pdf x.hwp  # 단발 변환
#
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# ── LibreOffice(Writer) + Java(H2Orestart 필수) + 한국어 폰트 + Python ──
# 폰트가 변환 품질의 절반: 나눔 + Noto CJK 로 한글 대체 글꼴 확보
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer \
      libreoffice-core \
      libreoffice-java-common \
      default-jre-headless \
      fonts-nanum \
      fonts-nanum-coding \
      fonts-nanum-extra \
      fonts-noto-cjk \
      fonts-noto-cjk-extra \
      python3 \
      python3-venv \
      curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

# ── H2Orestart 확장 (shared 설치 → 모든 프로파일에서 인식) ──
ARG H2O_VERSION=v0.7.12
RUN curl -fsSL -o /tmp/H2Orestart.oxt \
      "https://github.com/ebandal/H2Orestart/releases/download/${H2O_VERSION}/H2Orestart.oxt" \
    && unopkg add --shared /tmp/H2Orestart.oxt \
    && rm -f /tmp/H2Orestart.oxt

# ── Python 가상환경 + 웹 의존성 (PEP 668 회피) ──
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm -f /tmp/requirements.txt

# ── 변환 스크립트 + 앱 ──
COPY convert.sh /usr/local/bin/convert.sh
RUN chmod +x /usr/local/bin/convert.sh
COPY app/ /app/

# ── 작업 디렉터리(임시 변환 파일, 비루트 쓰기 가능) ──
ENV WORK_ROOT=/tmp/hwp2pdf
RUN mkdir -p /tmp/hwp2pdf && chmod 1777 /tmp/hwp2pdf

# ── 보안: 비루트 사용자 ──
RUN useradd -m -s /usr/sbin/nologin converter
USER converter
WORKDIR /app

# ── 런타임 설정 ──
ENV CONVERT_TIMEOUT=60 \
    MAX_CONCURRENCY=2 \
    MAX_SIZE_BYTES=20971520 \
    PORT=8000
EXPOSE 8000

# 기본: 웹서비스 (stress_test / convert.sh 는 --entrypoint 로 오버라이드)
CMD ["uvicorn", "main:app", "--app-dir", "/app", "--host", "0.0.0.0", "--port", "8000"]
