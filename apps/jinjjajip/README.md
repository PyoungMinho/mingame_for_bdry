# 진짜집 (Jinjjajip)

허위매물 없는 부동산 플랫폼. **사진은 실거주 세입자만 업로드** → 신뢰 점수·배지로 매물 신뢰도를 한눈에.

- 기획: `docs/planning/real-estate-plan.md`, `docs/planning/real-estate-direction.md`
- 디자인: `docs/design/real-estate-design-final.md` (토큰·컴포넌트·데이터 계약 권위 문서)

## 스택
Next.js 14.2.3 (App Router) · React 18 · TypeScript strict · Tailwind 3.4 · React Query 5 · Zustand 4 · Radix UI · Supabase (Auth/Postgres+PostGIS/Storage/Realtime)

> 오름(루트 `src/`)·tier-gg(`apps/tier-gg`)와 완전 격리된 독립 앱. 토큰은 `realestate.*` 네임스페이스.

## 개발
```bash
cd apps/jinjjajip
npm install
npm run dev        # http://localhost:3002
npm run type-check
npm run test
```

## 구조
```
src/
  app/            # 라우트 (/, /listings/[id], /verify, /auth/verify, /my) + api/
  components/     # P0 신뢰 컴포넌트 (TrustDonut, TrustScoreBadge, ScoreBreakdown, ListingCard ...)
  lib/
    types/domain.ts   # 프론트·백엔드 공통 도메인 타입 계약 (SSOT)
    utils.ts          # cn(), 금액 포맷
    supabase/         # 클라/서버 Supabase 클라이언트
supabase/
  migrations/     # 스키마·RLS·PostGIS·인덱스
  functions/      # Edge Functions (스코어 엔진, 사진 파이프라인)
```

## 절대 제약 (디자인 §10.1)
1. 신뢰순 정렬 = **서버 사전계산값**. 프론트 정렬 금지.
2. **낙관적 UI 금지**. 업로드·신고·점수 갱신은 서버 확정값만.
3. EXIF·블러는 **100% 서버** 처리.
4. 매물 상세 = **RSC**.
5. 원본 사진 **비공개**, 공개는 블러 통과본만.
6. 신고 즉시 **비공개**(notice-and-takedown), 리스트 제외.
7. `earned/score === null` = pending(검증 대기), **0점과 구분**.
