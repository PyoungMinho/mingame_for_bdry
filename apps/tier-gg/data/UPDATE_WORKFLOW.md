# Tier.gg — 데이터 갱신 워크플로우

DB 설계자: @DB설계자 (Sonnet) — 2026-05-28

---

## 3티어 데이터 갱신 주기

| Tier | 소스 유형 | 갱신 주기 | 담당 | 방법 |
|---|---|---|---|---|
| T1 | 공식 (OpenAI/Anthropic/Google 가격표, 공식 벤치마크) | 주 1회 (월요일 09:00 KST) | GitHub Actions cron | 공식 사이트 스크래핑 + 관리자 승인 |
| T2 | 외부 집계 (Artificial Analysis, LMArena, OpenRouter) | 격주 (홀수주 수요일) | GitHub Actions cron | RSS/API 폴링 + 인용만 (직접 측정 X) |
| T3 | 커뮤니티/사용자 입력 | v1.1 이후 | - | 미정 |

---

## 신모델 등록 30분 SLA 절차

신모델 발표 감지부터 사이트 반영까지 **목표 30분** 이내.

```
00:00 RSS 감지 (GitHub Actions cron 5분 간격)
        ↓ 공식 블로그·RSS 피드 신규 항목 감지
        ↓ Slack #tier-gg-alerts 채널 자동 알림
00:05 관리자 확인
        ↓ 공식 발표 URL + 가격표 확인
        ↓ 초기 벤치마크 수치 수집 (공식 발표 기준)
00:15 데이터 입력
        ↓ status = 'review' 로 entities INSERT
        ↓ 가용 점수 scores INSERT (source T1, confidence T1)
        ↓ sources에 공식 URL + verified_at 등록
00:25 검증 & 발행
        ↓ 관리자 최종 확인 (가격·컨텍스트 윈도우 이중 확인)
        ↓ status = 'published' 업데이트
        ↓ Next.js ISR revalidate 트리거 (revalidatePath)
00:30 사이트 반영 완료
        ↓ Slack #tier-gg-alerts 완료 알림
        ↓ mock-models.ts도 동시 PR 생성 (정적 백업)
```

---

## GitHub Actions cron 예시

### T1 가격 갱신 (주 1회)

```yaml
# .github/workflows/update-prices-t1.yml
name: Update T1 Prices (Weekly)

on:
  schedule:
    # 매주 월요일 00:00 UTC (09:00 KST)
    - cron: '0 0 * * 1'
  workflow_dispatch:  # 수동 실행 허용

jobs:
  update-prices:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Fetch OpenAI pricing
        run: node scripts/fetch-openai-pricing.mjs
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Fetch Anthropic pricing
        run: node scripts/fetch-anthropic-pricing.mjs
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Fetch Google pricing
        run: node scripts/fetch-google-pricing.mjs
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Trigger ISR revalidation
        run: |
          curl -X POST "${{ secrets.NEXT_REVALIDATE_URL }}" \
            -H "Authorization: Bearer ${{ secrets.REVALIDATE_SECRET }}" \
            -d '{"tag":"models"}'

      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v1.26.0
        with:
          channel-id: 'tier-gg-alerts'
          slack-message: |
            T1 가격 갱신 완료: ${{ job.status }}
            실행 시각: ${{ github.run_started_at }}
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

---

### T2 벤치마크 갱신 (격주)

```yaml
# .github/workflows/update-benchmarks-t2.yml
name: Update T2 Benchmarks (Biweekly)

on:
  schedule:
    # 홀수주 수요일 02:00 UTC (11:00 KST)
    - cron: '0 2 * * 3/2'
  workflow_dispatch:

jobs:
  update-benchmarks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Fetch LMArena Elo scores
        run: node scripts/fetch-arena-elo.mjs
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Fetch Artificial Analysis scores
        run: node scripts/fetch-artificial-analysis.mjs
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Create PR for review
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'data: T2 벤치마크 갱신 ${{ github.run_number }}'
          title: '[Data] T2 벤치마크 갱신 — 관리자 검토 필요'
          body: |
            ## T2 벤치마크 자동 갱신

            - 소스: Artificial Analysis, LMArena
            - 갱신 대상: Arena Elo, Speed (tokens/s)
            - 관리자 검토 후 merge

            **주의**: T2 데이터는 인용만 허용. 직접 측정값 아님.
          branch: 'data/t2-benchmark-update-${{ github.run_number }}'
          labels: 'data-update,needs-review'
```

---

### RSS 신모델 감지 (5분 간격)

```yaml
# .github/workflows/detect-new-models.yml
name: Detect New AI Models (RSS)

on:
  schedule:
    # 5분마다 실행
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  detect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Check RSS feeds
        id: rss_check
        run: node scripts/check-rss-feeds.mjs
        env:
          RSS_FEEDS: |
            https://openai.com/blog/rss.xml
            https://www.anthropic.com/rss.xml
            https://blog.google/technology/ai/rss/
            https://ai.meta.com/blog/rss/
            https://mistral.ai/news/rss.xml
          LAST_CHECK_GIST_ID: ${{ secrets.LAST_CHECK_GIST_ID }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Alert on new model detected
        if: steps.rss_check.outputs.new_model_detected == 'true'
        uses: slackapi/slack-github-action@v1.26.0
        with:
          channel-id: 'tier-gg-alerts'
          slack-message: |
            :rocket: *신모델 감지!*
            제목: ${{ steps.rss_check.outputs.model_title }}
            URL: ${{ steps.rss_check.outputs.model_url }}
            출처: ${{ steps.rss_check.outputs.provider }}

            30분 SLA 시작 — 즉시 확인 바람
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

---

## 데이터 볼륨 예측

| 테이블 | 1년 후 예상 행 수 | 5년 후 | 파티셔닝 필요 시점 |
|---|---|---|---|
| entities | ~500 | ~3,000 | 불필요 |
| scores | ~20,000 | ~150,000 | 불필요 |
| sources | ~2,000 | ~15,000 | 불필요 |
| changelog | ~50,000 | ~500,000 | 500만 행 초과 시 changed_at 기준 range partition |

Supabase Free tier (500MB)는 약 2-3년 커버 가능.
월 30만 UV 달성 시 Supabase Pro($25/월) 전환 권장.

---

## mock-models.ts 동기화 원칙

- DB가 source of truth, mock-models.ts는 빌드 타임 스냅샷
- 신모델 DB 등록 후 반드시 mock-models.ts PR도 동시 생성
- mock-models.ts는 페이지 빌드 시 import — DB 장애 시 fallback 역할
- 가격 변동은 mock-models.ts에도 반영 (주 1회 자동 스크립트 예정)
