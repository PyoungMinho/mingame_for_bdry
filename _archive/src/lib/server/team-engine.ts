/**
 * 팀메이크 파이프라인 엔진
 * 16명의 에이전트를 PIPELINE 순서대로 구동한다.
 * - 그룹 내부: 병렬 실행 (스트림 머지)
 * - 그룹 간/단계 간: 순차 실행 (이전 산출물을 다음 프롬프트에 전달)
 * - ANTHROPIC_API_KEY 존재 시 실제 Claude 스트리밍, 없으면 데모 시뮬레이션.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  AGENTS,
  PIPELINE,
  SHARED_TEAM_CONTEXT,
  modelForTier,
  leadOfStage,
  type AgentDef,
  type PipelineStage,
} from "./team-agents";

// ---------------------------------------------------------------------------
// 이벤트 타입 (SSE로 직렬화됨)
// ---------------------------------------------------------------------------

export type EngineEvent =
  | { type: "pipeline_start"; mode: EngineMode; topic: string; stages: StageMeta[] }
  | { type: "stage_start"; stageId: string; label: string; sub: string }
  | {
      type: "agent_start";
      stageId: string;
      agentId: string;
      name: string;
      color: string;
      role: string;
      team: string;
    }
  | { type: "agent_delta"; agentId: string; text: string }
  | { type: "agent_done"; agentId: string; output: string }
  | { type: "stage_done"; stageId: string }
  | { type: "pipeline_done" }
  | { type: "error"; message: string };

export type EngineMode = "live" | "demo";
export interface StageMeta {
  id: string;
  label: string;
  sub: string;
}

export interface RunOptions {
  topic: string;
  /** 특정 단계만 실행 (예: ["plan"]). 미지정 시 전체 파이프라인 */
  stageIds?: string[];
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** API 키 유무로 실행 모드 판별 (placeholder 키는 데모로 취급) */
export function detectMode(): EngineMode {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || key.startsWith("sk-ant-your") || key === "demo") return "demo";
  return "live";
}

function maxTokensForTier(tier: AgentDef["tier"]): number {
  switch (tier) {
    case "opus":
      return 2200;
    case "sonnet":
      return 1600;
    case "haiku":
      return 1200;
  }
}

/** 여러 async generator를 동시에 진행시키며 도착 순서대로 이벤트를 yield */
async function* mergeStreams<T>(streams: AsyncGenerator<T>[]): AsyncGenerator<T> {
  const arm = (it: AsyncGenerator<T>, i: number) =>
    it.next().then((res) => ({ res, i }));

  const iterators = streams;
  const pending = new Map<number, Promise<{ res: IteratorResult<T>; i: number }>>();
  iterators.forEach((it, i) => pending.set(i, arm(it, i)));

  while (pending.size > 0) {
    const { res, i } = await Promise.race(pending.values());
    if (res.done) {
      pending.delete(i);
    } else {
      yield res.value;
      pending.set(i, arm(iterators[i], i));
    }
  }
}

// ---------------------------------------------------------------------------
// 프롬프트 구성
// ---------------------------------------------------------------------------

interface PriorOutput {
  label: string;
  agent: string;
  text: string;
}

function buildUserPrompt(
  agent: AgentDef,
  topic: string,
  priorStageLeads: PriorOutput[],
  withinStage: { agent: string; text: string }[]
): string {
  let s = `[프로젝트 주제]\n${topic}\n`;

  if (priorStageLeads.length > 0) {
    s += `\n[이전 단계 핵심 산출물]`;
    for (const c of priorStageLeads) {
      s += `\n\n### ${c.label} — ${c.agent}\n${c.text}`;
    }
    s += `\n`;
  }

  if (withinStage.length > 0) {
    s += `\n[현재 단계 동료가 먼저 낸 산출물]`;
    for (const w of withinStage) {
      s += `\n\n### ${w.agent}\n${w.text}`;
    }
    s += `\n`;
  }

  s += `\n[당신의 작업]\n위 맥락을 바탕으로 "${agent.name}"(${agent.role}) 역할의 산출물을 작성하세요.`;
  return s;
}

// ---------------------------------------------------------------------------
// 에이전트 실행 — 실제 Claude
// ---------------------------------------------------------------------------

async function* runAgentLive(
  client: Anthropic,
  agent: AgentDef,
  stageId: string,
  userPrompt: string
): AsyncGenerator<EngineEvent> {
  yield {
    type: "agent_start",
    stageId,
    agentId: agent.id,
    name: agent.name,
    color: agent.color,
    role: agent.role,
    team: agent.team,
  };

  let full = "";
  try {
    const stream = client.messages.stream({
      model: modelForTier(agent.tier),
      max_tokens: maxTokensForTier(agent.tier),
      system: [
        {
          type: "text",
          text: SHARED_TEAM_CONTEXT,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: agent.system },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    for await (const ev of stream) {
      if (
        ev.type === "content_block_delta" &&
        ev.delta.type === "text_delta"
      ) {
        full += ev.delta.text;
        yield { type: "agent_delta", agentId: agent.id, text: ev.delta.text };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const note = `\n\n_(${agent.name} 호출 실패: ${message})_`;
    full += note;
    yield { type: "agent_delta", agentId: agent.id, text: note };
  }

  yield { type: "agent_done", agentId: agent.id, output: full };
}

// ---------------------------------------------------------------------------
// 에이전트 실행 — 데모 시뮬레이션
// ---------------------------------------------------------------------------

async function* runAgentDemo(
  agent: AgentDef,
  stageId: string,
  topic: string
): AsyncGenerator<EngineEvent> {
  yield {
    type: "agent_start",
    stageId,
    agentId: agent.id,
    name: agent.name,
    color: agent.color,
    role: agent.role,
    team: agent.team,
  };

  const text = demoOutput(agent, topic);
  const tokens = text.match(/\S+\s*/g) ?? [text];
  let full = "";

  // 자연스러운 타이핑 효과: 2~5 토큰씩 묶어서 전송
  let buf = "";
  let count = 0;
  for (const t of tokens) {
    buf += t;
    full += t;
    count++;
    if (count >= 2 + Math.floor(Math.random() * 3)) {
      yield { type: "agent_delta", agentId: agent.id, text: buf };
      buf = "";
      count = 0;
      await sleep(18);
    }
  }
  if (buf) yield { type: "agent_delta", agentId: agent.id, text: buf };

  yield { type: "agent_done", agentId: agent.id, output: full };
}

// ---------------------------------------------------------------------------
// 메인 파이프라인 제너레이터
// ---------------------------------------------------------------------------

export async function* runPipeline(opts: RunOptions): AsyncGenerator<EngineEvent> {
  const { topic } = opts;
  const mode = detectMode();

  const stages: PipelineStage[] = opts.stageIds?.length
    ? PIPELINE.filter((s) => opts.stageIds!.includes(s.id))
    : PIPELINE;

  const stageMeta: StageMeta[] = stages.map((s) => ({
    id: s.id,
    label: s.label,
    sub: s.sub,
  }));

  yield { type: "pipeline_start", mode, topic, stages: stageMeta };

  let client: Anthropic | null = null;
  if (mode === "live") {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  const priorStageLeads: PriorOutput[] = [];

  for (const stage of stages) {
    yield { type: "stage_start", stageId: stage.id, label: stage.label, sub: stage.sub };

    const withinStage: { agent: string; text: string }[] = [];

    for (const group of stage.groups) {
      const agents = group
        .map((id) => AGENTS[id])
        .filter((a): a is AgentDef => Boolean(a));

      const makeRunner = (a: AgentDef): AsyncGenerator<EngineEvent> => {
        const prompt = buildUserPrompt(a, topic, priorStageLeads, withinStage);
        return mode === "live" && client
          ? runAgentLive(client, a, stage.id, prompt)
          : runAgentDemo(a, stage.id, topic);
      };

      const groupOutputs: Record<string, string> = {};

      for await (const ev of mergeStreams(agents.map(makeRunner))) {
        if (ev.type === "agent_done") groupOutputs[ev.agentId] = ev.output;
        yield ev;
      }

      for (const a of agents) {
        withinStage.push({ agent: a.name, text: groupOutputs[a.id] ?? "" });
      }
    }

    // 단계 대표(리드) 산출물을 다음 단계 컨텍스트로 전달
    const leadId = leadOfStage(stage.id);
    const lead = AGENTS[leadId];
    if (lead) {
      const leadText = withinStage.find((w) => w.agent === lead.name)?.text ?? "";
      priorStageLeads.push({ label: stage.label, agent: lead.name, text: leadText });
    }

    yield { type: "stage_done", stageId: stage.id };
  }

  yield { type: "pipeline_done" };
}

// ---------------------------------------------------------------------------
// 데모 산출물 (API 키 없을 때) — 주제를 반영한 현실적인 마크다운
// ---------------------------------------------------------------------------

function demoOutput(agent: AgentDef, topic: string): string {
  const t = topic.trim() || "새로운 제품";
  const map: Record<string, string> = {
    창의팀원: `"${t}" 아이디어 발산입니다.

- **핵심 컨셉**: ${t}의 가장 큰 불편을 한 번에 해소하는 올인원 도구
- 온보딩 30초 — 가입 즉시 첫 결과물을 보여 주는 "아하 모먼트" 설계
- 템플릿 마켓플레이스로 사용자가 서로의 결과물을 재사용
- AI 자동 추천: 사용 패턴 학습 후 다음 액션 제안
- 협업 모드 — 팀 단위 공유 워크스페이스
- 모바일 우선 캡처 → 데스크톱 정리 흐름
- 게이미피케이션(연속 사용 보상)으로 리텐션 강화
- 무료 체험 → 사용량 기반 업셀 트리거

타겟: ${t}에 시간을 많이 쓰는 1인 창업가·소규모 팀. 차별점은 "설정 없이 바로 쓰는" 속도.`,

    비평팀원: `"${t}" 리스크 점검입니다.

- **시장**: 유사 솔루션 다수 — 차별점이 약하면 가격 경쟁에 휘말림
- **기술**: AI 품질 편차 → 결과 신뢰도 이슈, 환각 가능성
- **운영**: 초기 콘텐츠/템플릿 공급 부족 시 빈 페이지 문제
- **수익화**: 무료에서 유료 전환 장벽 — 가치 증명 타이밍 중요
- **법규**: 사용자 데이터 처리·개인정보 동의 흐름 필요
- **리텐션**: 한 번 쓰고 이탈하는 도구성 한계
- 실패 사례: 비슷한 올인원 도구들이 "넓고 얕은" 기능으로 묻힌 전례 있음`,

    창의기획자: `## 핵심 컨셉 수렴

"${t}"를 **프롬프트 한 줄로 끝내는 자동화 워크스페이스**로 정의합니다.

### MVP 핵심 기능 (우선순위)
1. 입력 → 자동 결과 생성 (핵심 가치, P0)
2. 결과물 저장·버전 관리 (P0)
3. 템플릿 시작점 제공 (P1)
4. 공유 링크 (P1)
5. 사용량 대시보드 (P2)

### 수익 모델 가설
무료(월 1회) → Pro(무제한, 49,000원) → Team(협업+API, 149,000원). 전환 핵심은 "두 번째 사용 시점의 명확한 가치".`,

    비평기획자: `## 치명 리스크 Top 3

1. **차별화 부족** — 완화: 특정 버티컬(${t})에 집중, 일반 도구와 분리
2. **AI 품질 신뢰** — 완화: 휴먼 리뷰 체크포인트 + 결과 평가 루프
3. **유료 전환율** — 완화: 무료 단계에서 "완성형 결과 1개"를 끝까지 경험시켜 가치 증명

### 출시 전 검증 가정
- 타겟이 실제로 이 작업에 돈을 낼 의사가 있는가 (사전 판매 테스트)
- 첫 결과물 품질이 재방문을 유도하는가 (리텐션 코호트)`,

    기획팀장: `## 제품 한 줄 정의
"${t}"를 프롬프트 한 줄로 자동 완성하는 1인 창업가용 워크스페이스.

## 타겟 사용자
${t} 작업에 반복적으로 시간을 쓰는 솔로프리너·5인 이하 팀.

## 핵심 기능 (MVP)
1. 입력 → 자동 결과 생성
2. 결과 저장·버전·공유
3. 시작 템플릿
4. 사용량 대시보드

## 수익 모델
Free(월1) / Pro 49,000원(무제한) / Team 149,000원(협업·API). 목표: Pro 204명 = 월 1,000만원.

## 핵심 리스크와 대응
- 차별화 → 버티컬 집중
- AI 품질 → 리뷰 루프
- 전환율 → 무료에서 완성형 1회 경험

## 성공 지표
주간 활성 유지율 40%+, 무료→Pro 전환 5%+, 7일 리텐션 35%+.`,

    UX디자이너: `## 핵심 화면 (5)
1. **랜딩** — 가치 제안 + 무료 시작
2. **대시보드** — 프로젝트 목록·새 프로젝트 CTA
3. **워크스페이스** — 입력창 + 진행 상태 + 결과 뷰어
4. **결과 상세** — 산출물 열람·다운로드·공유
5. **설정/요금제** — 구독 관리

## 주요 플로우
가입 → 주제 입력 → 자동 실행(진행 표시) → 결과 확인 → 저장/공유 → (가치 인지) 업그레이드.

## 내비게이션
좌측 사이드바(프로젝트) + 상단 사용량/프로필. 모바일은 하단 탭.`,

    UI디자이너: `## 무드·톤
신뢰감 있는 다크 테크. 키워드: precise, calm, premium.

## 컬러 팔레트
- 주색 보라→파랑 그라디언트: \`#7C3AED → #2563EB\`
- 배경: \`#0A0A0F\` / 카드: \`#13131A\`
- 텍스트: \`#FFFFFF\` / 서브: \`rgba(255,255,255,.5)\`

## 타이포그래피
헤딩·본문 모두 Pretendard (한국어 최적화), 숫자/코드는 mono.

## 핵심 컴포넌트
버튼(그라디언트/고스트), 카드(글래스), 진행 스텝퍼, 채팅 버블, 토스트.`,

    디자인팀장: `## 화면 목록·우선순위
랜딩(P0) · 대시보드(P0) · 워크스페이스(P0) · 결과상세(P1) · 요금제(P1).

## 디자인 시스템 요약
- 컬러: 보라-파랑 그라디언트 + 다크 베이스(#0A0A0F/#13131A)
- 타이포: Pretendard, 1.5 line-height
- 간격: 4px 그리드, 카드 radius 16px

## 핵심 컴포넌트 스펙
글래스 카드(border-white/8, blur), 그라디언트 CTA, 6단계 진행 스텝퍼, 에이전트 채팅 버블(색상=에이전트 고유색).

## 핸드오프 노트
다크 기본, 접근성 대비 4.5:1 확보, 모바일 375px 우선 검증.`,

    컴포넌트개발자: `## 핵심 컴포넌트
- \`<Button variant>\` — gradient | ghost
- \`<GlassCard>\` — 글래스 카드 래퍼
- \`<StageStepper steps>\` — 진행 표시
- \`<AgentBubble agent>\` — 에이전트 메시지

스택: Next.js + TypeScript + Tailwind.

\`\`\`tsx
export function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#13131A] p-5 backdrop-blur-xl">
      {children}
    </div>
  );
}
\`\`\``,

    페이지개발자: `## 라우트 구조
\`\`\`
src/app/
  page.tsx              # 랜딩
  dashboard/
    page.tsx            # 대시보드
    project/[id]/page.tsx  # 워크스페이스
  api/pipeline/route.ts # SSE 스트림
\`\`\`

## 데이터 전략
워크스페이스는 \`/api/pipeline\`에 POST 후 SSE로 실시간 수신. 상태는 로컬 useState + 스트림 누적.

대표 골격은 EventSource 대신 fetch + ReadableStream reader로 SSE 파싱.`,

    프론트팀장: `## 디렉토리 구조
app(라우트) / components(재사용) / lib/server(엔진·SSE).

## 상태 관리
서버 스트림 단일 출처 → 클라이언트는 누적만. 전역 상태 라이브러리 불필요.

## 성능·접근성
스트리밍 중 autoscroll, prefers-reduced-motion 존중, 포커스 링 유지, 키보드 전송(Enter).

## 남은 작업
SSE 재연결 처리, 결과 다운로드, 모바일 레이아웃 검증.`,

    API설계자: `## 엔드포인트
| METHOD | PATH | 설명 |
|---|---|---|
| POST | /api/pipeline | 주제 받아 SSE 스트림 시작 |
| GET | /api/projects | 프로젝트 목록 |
| POST | /api/projects | 프로젝트 생성 |

## 인증·정책
Supabase 세션 쿠키. 레이트리밋(IP+유저). 에러는 \`{ error, code }\` 규약.

## 대표 스키마
요청: \`{ topic: string, stageIds?: string[] }\` → 응답: \`text/event-stream\` (data: JSON per event).`,

    DB설계자: `## 핵심 테이블
- \`projects\`(id, user_id, topic, status, created_at)
- \`runs\`(id, project_id, stage, mode, started_at, finished_at)
- \`messages\`(id, run_id, agent_id, role, content, created_at)

## 인덱스
\`messages(run_id, created_at)\`, \`projects(user_id, created_at)\`.

\`\`\`sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  topic text not null,
  status text not null default 'running',
  created_at timestamptz default now()
);
\`\`\``,

    백엔드팀장: `## 시스템 구성
Next.js Route Handler → 파이프라인 엔진(async generator) → Claude API. 산출물은 Supabase Postgres, 사용량은 Upstash Redis.

## 데이터 흐름
클라이언트 POST → 엔진 스트림 → SSE 중계 → 동시에 messages 영속화.

## 보안 체크리스트
- API 키는 서버 전용(절대 클라이언트 노출 금지)
- 유저별 레이트리밋·예산 상한
- 입력 길이/내용 검증(zod)

## 확장성
스테이지 단위 재시도, 큐 분리 여지.`,

    QA설계자: `## 테스트 범위·우선순위
P0: 파이프라인 스트림 정상 종료 · SSE 파싱 · 빈 주제 방어.
P1: 단계별 산출물 순서 · 데모/라이브 모드 분기.

## 핵심 케이스
- 정상: 주제 입력 → 6단계 모두 done → pipeline_done 수신
- 경계: 매우 긴 주제, 이모지·특수문자
- 실패: API 키 오류 시 데모 폴백, 네트워크 중단 시 graceful 종료

## 완료 정의
모든 P0 통과, 콘솔 에러 0, 모바일/데스크톱 렌더 정상.`,

    QA실행자: `## 실행 요약
케이스 12개 중 11 통과, 1 경고.

## 발견 이슈
- [경미] 매우 긴 주제 입력 시 채팅 영역 가로 스크롤 → \`break-words\` 적용 권장
- [정보] 데모 모드에서 진행 속도가 빠름 → 의도된 동작

## 최종 판정
**GO** — 핵심 플로우(입력→스트림→결과) 안정적. 위 경미 이슈는 출시 후 패치 가능.`,
  };

  return map[agent.id] ?? `${agent.name}(${agent.role})의 "${t}" 산출물입니다.`;
}
