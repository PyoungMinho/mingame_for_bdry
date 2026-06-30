# HWP → PDF 변환 웹서비스 프로젝트 브리프

## 1. 프로젝트 한 줄 정의
한컴오피스가 없는 사람(맥 사용자, 해외 거주자, 외국인)이 .hwp / .hwpx 파일을
업로드 한 번으로 PDF로 변환해서 받는 초단순 웹서비스.

**핵심 가치:** 가입 없음, 광고 최소, 변환 품질 우선. "지금 당장 이 파일을 열어야 하는" 절박한 순간에 가장 빠른 해결책.

---

## 2. 진행 순서 (이 순서를 지킬 것)

### 0단계 — 기술 검증 (제일 먼저, 반나절)  ← **✅ 통과 (GO, 4/5)**
서비스를 만들기 전에 변환 품질부터 확인한다. 여기서 실패하면 프로젝트 방향을 바꾼다.
- [x] LibreOffice 설치 (headless 모드 사용)
- [x] H2Orestart 확장 설치 — LibreOffice가 HWP/HWPX를 읽게 해주는 오픈소스 확장 (v0.7.12)
  - GitHub: https://github.com/ebandal/H2Orestart
- [x] 테스트 파일 5종 준비: ① 텍스트 위주 ② 표 많은 공문서 ③ 이미지 포함 ④ 수식 포함 ⑤ hwpx
  - 실제 정부/공공 문서로 확보 (행안부·대구대·서울시 정보소통광장)
- [x] 평가 기준: 표 깨짐 / 폰트 대체 품질 / 이미지 보존 / 페이지 레이아웃 — 육안 검수(PDF 렌더)
- [x] **판정: GO (4/5 실사용 가능)** — 아래 검증 결과표 참조

#### 📊 0단계 검증 결과 (2026-06-15)
| 유형 | 테스트 파일 (출처) | 결과 | 품질 |
|---|---|---|---|
| ① 텍스트 | 01_gov_mois.hwp (행정안전부 공문) | ✅ | **우수** — 본문/헤더표/순서도 박스 |
| ② 표 많은 공문서 | 04_daegu_apply.hwp (대구대 신청서) | ✅ | **우수** — 병합셀·중첩표·셀배경색·컬러텍스트 |
| ③ 이미지 포함 | 01_gov_mois.hwp (임베드 스크린샷) | ✅ | **우수** — 이미지 보존 |
| ⑤ hwpx | 05_seoul_report.hwpx (서울시 보고서서식) | ✅ | **우수** — 다색로고·도형(타원)·점선리더·특수문자 |
| ⑤ hwpx | 07_seoul_gas.hwpx (서울시 2026 공문) | ✅ | **우수** — 공문양식·서명블록·결재푸터표 |
| ④ 수식 | 02_equation.hwp / 06_equation.hwpx | ❌ | **미검증/위험** — 합성 픽스처 2개 모두 실패(백지/LO크래시), 깨끗한 실샘플 미확보 |

- **공통 폰트 품질**: 나눔/Noto CJK 대체 깔끔. 유일한 흠 = 키캡 문자표(󰏚) 일부 두부박스(사소).
- **⑤ hwpx 진단**: 정상 hwpx(표 fixture)는 완벽 변환 확인 → hwpx 경로 자체는 견고. 초기 실패 2건은 병리적 파일(에러 회귀 픽스처/최소 합성)이었음.
- **④ 수식 = 알려진 약점 구역**: LibreOffice의 HWP 수식 필터가 업계 공통 최약 지점. 제품 전략으로 "잘 되는 유형 광고 + 수식 多 문서 경고/실패 로깅"으로 대응 (convert.sh 에러코드 이미 구현).
- **결론**: 기준(5종 중 4종↑) 충족 → **GO**. 수식은 문서화된 엣지케이스로 안고 진행.

### 1단계 — 로컬 변환 파이프라인 (1~2일)  ← **✅ 완료**
- [x] Docker 이미지: Ubuntu + LibreOffice + H2Orestart + 한국어 폰트(나눔, Noto CJK)
- [x] 변환 스크립트(convert.sh): 입력 → soffice headless → PDF → 타임아웃/에러 처리
- [x] 동시 변환 처리: `app/converter.py` = asyncio 바운드 워커 풀(MAX_CONCURRENCY) + convert.sh 위임
  - **검증**: `app/stress_test.py` — 실제 샘플 16개 동시 투입, 동시성 2·4 모두 **16/16 성공**, 출력 크기 100% 일치(교차오염 0). LO 동시실행 취약성 리스크 해소.

### 2단계 — 웹서비스 MVP (3~5일)  ← **✅ 완료(로컬)**
- [x] 페이지 1개: 드래그앤드롭 업로드 → 진행 표시 → 다운로드 (`app/index.html`)
- [x] 백엔드: FastAPI(`app/main.py`) — `GET /` · `POST /api/convert` · `GET /healthz`
- [x] 제한: 파일 20MB, 타임아웃 60초 (converter/convert.sh)
- [x] **개인정보 강점:** "변환 후 즉시 삭제, 서버 미저장" 첫 화면 명시 + **실측 검증**(변환 후 임시디렉터리 잔존 0)
- [x] 변환 실패 시 친절한 에러 + 실패 유형 로깅 (HTTP 400/422 + code/reason 로그)
  - **검증**: HWP/HWPX 변환 PDF 크기 known-good 정확 일치, 미지원확장자→400, 변환실패→422(친절 메시지)

### 2.5단계 — 출시 마감 다듬기  ← **✅ 완료(로컬, PM "배포 전 마감" 선택)**
- [x] **진행률 UX**: 스피너 → 추정 진행률 바 + 경과시간(초) + 단계 라벨(업로드→변환 중→완료). 단일 응답이라 실제 %는 불가 → 경과시간 기반 점근 채움 + 응답 시 100% 스냅. 변환 후 "다른 파일 변환" 리셋 버튼.
- [x] **SEO 랜딩(한/영)**: `GET /`(한국어)·`GET /en`(영어) 동일 기능 2개 랜딩 + 언어 토글(KO/EN, history.replaceState). 양 언어 텍스트를 DOM에 동시 보유(크롤링 가능).
  - 메타: title/description/keywords, Open Graph, Twitter Card, canonical, **hreflang(ko/en/x-default)**, 인라인 SVG 파비콘.
  - 구조화 데이터: **JSON-LD**(WebApplication + FAQPage 6문항) — 검색엔진 리치결과 대비.
  - `GET /robots.txt`(api 비공개 + Sitemap), `GET /sitemap.xml`(hreflang 대체 링크 포함).
  - 도메인 의존 절대 URL은 **환경변수 `SITE_URL`** 한 줄로 주입(미설정 시 상대경로로 무해 degrade) → 배포 때만 채우면 됨.
  - SEO용 가시 콘텐츠: FAQ 6문항(맥에서 hwp 열기/한컴 없이 변환/안전성 등 타깃 키워드 자연 삽입).
- [x] **약관·개인정보·면책**(브리프 "면책 조항 필수"): 푸터 접이식 — 결과 정확성 무보장(수식·복잡 레이아웃), 권리 있는 파일만 업로드, 변환 직후 삭제·미저장, as-is 무보증, 파일 내용 미로깅. HWP 한컴 상표 비제휴 고지.
- [x] **검증**: Docker 재빌드 후 `/`·`/en`·`/robots.txt`·`/sitemap.xml` 정상, SITE_URL 주입 확인, 변환 회귀(크기 정확 일치)·즉시삭제(잔존 0)·에러(400/422) 유지, JSON-LD 파싱 유효, **브라우저 렌더 육안 확인(한/영 토글·진행률 바 단계 전환 정상)**.

### 3단계 — 배포 (1~2일)
- [ ] Docker 띄울 VPS 1대 (월 1~2만원대)
- [ ] 도메인 + HTTPS (Cloudflare 무료)
- [ ] 모니터링: 성공률 / 일일 변환 수 / 평균 처리 시간

### 4단계 — 수익화 + SEO (출시 후)
- [ ] 무료: 1일 3회 (IP/브라우저 기준, 가입 없음)
- [ ] 수익: ① 한도초과 소액결제(토스/포트원) ② 절제된 애드센스 ③ B2B API
- [~] SEO: 한/영 랜딩·메타·구조화데이터·robots·sitemap **완료(2.5단계)**. 잔여 = 실제 도메인 SITE_URL 주입 + 키워드("hwp pdf 변환"·"hwp viewer mac"·"open hwp file") 순위 추적/콘텐츠 보강

---

## 3. 기술 스택
| 영역 | 선택 | 이유 |
|---|---|---|
| 변환 엔진 | LibreOffice headless + H2Orestart | 검증된 오픈소스, 무료 |
| 백엔드 | Python FastAPI | 변환 스크립트와 같은 언어 |
| 큐 | 초기 인메모리 / 성장 시 Redis | 동시 변환 제어 |
| 프론트 | 순수 HTML/JS 또는 React 단일 페이지 | 페이지 1개면 충분 |
| 인프라 | Docker + VPS 1대 + Cloudflare | 고정비 최소 |
| 결제 | 포트원 또는 토스페이먼츠 | 한국 소액결제 표준 |

---

## 4. 알려진 리스크와 대응
1. **변환 품질 한계** — 복잡 레이아웃(글상자 중첩, 특수 개체) 깨질 수 있음 → 0단계 검증, 실패 유형 로깅, "잘 되는 유형" 광고
2. **법적 검토** — HWP 스펙 공개·hwpx KS 표준, 오픈소스 파서 관행이나 약관에 면책 조항 필수
3. **경쟁 존재** — allinpdf, coolutils 등 → 차별점: ① 품질(폰트) ② 광고 절제+즉시 삭제 ③ 영어권 SEO
4. **악성 파일** — 업로드 검증, 컨테이너 격리, 실행권한 제거
5. **LibreOffice 행(hang)** — 타임아웃 + 좀비 프로세스 킬 (convert.sh에 구현됨)

---

## 6. 성공/중단 기준
- **0단계 통과:** 테스트 5종 중 4종 이상 실사용 가능 품질
- **출시 1개월:** 일 변환 50건 + 유료 전환 1건 이상 → 계속
- **중단:** 2개월간 유료 전환 0건 → 피벗(hwpx 특화 / API 전용 / 다른 아이디어)

---

## 현재 산출물 (hwp2pdf/)
- `convert.sh` — HWP/HWPX→PDF 변환 (타임아웃 60s, 에러코드 0~5, 좀비 킬, mac/linux 호환)
- `Dockerfile` — Ubuntu24.04 + LibreOffice + H2Orestart v0.7.12 + 나눔/Noto CJK + Python/FastAPI(venv)
- `requirements.txt` — fastapi · uvicorn[standard] · python-multipart
- `app/converter.py` — 동시 변환 코어(asyncio 워커 풀 + convert.sh 위임 + 즉시삭제)
- `app/main.py` — FastAPI 웹서비스 (`/` 한국어 · `/en` 영어 · `/api/convert` · `/healthz` · `/robots.txt` · `/sitemap.xml`; `SITE_URL` env로 SEO 절대URL 주입)
- `app/index.html` — 단일 페이지 UI(드래그앤드롭·**추정 진행률 바+경과시간+단계**·다운로드·다시변환, 신뢰문구·**KO/EN 토글**, **FAQ·약관/개인정보/면책**, OG/Twitter/**JSON-LD** 메타)
- `app/stress_test.py` — 동시 변환 안전성 검증 스크립트
- `H2Orestart.oxt` — 변환 확장 (로컬 검증용)
- `samples/` — 검증 테스트 파일 + 변환 결과 PDF (검증 증거)

### 실행 방법
```
docker build -t hwp2pdf .
docker run --rm -p 8000:8000 hwp2pdf            # 웹서비스 → http://localhost:8000 (영어: /en)
# 배포 시 SEO 절대URL 주입:  docker run --rm -e SITE_URL=https://your-domain -p 8000:8000 hwp2pdf
# 동시변환 테스트:  docker run --rm --entrypoint python3 -v "$PWD/samples:/work" hwp2pdf /app/stress_test.py
```
