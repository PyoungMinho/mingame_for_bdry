/**
 * 목 데이터 — 백엔드 미가동 시 페이지 렌더를 위한 샘플 데이터.
 * 훅은 API 실패 시 이 데이터로 폴백 (개발 편의).
 * 실제 fetch 경로가 항상 우선.
 */
import type {
  Diary,
  Panel,
  QuotaInfo,
  ToonlogSSEEvent,
  GenerationJob,
} from "./contract";

export const MOCK_PANELS: Panel[] = [
  {
    index: 1,
    imageUrl: "https://placehold.co/512x512/FAF7F2/1A1A1A?text=컷+1",
    previewUrl: "https://placehold.co/512x512/FAF7F2/1A1A1A?text=컷+1",
    caption: "아침에 일어나 창밖을 바라보는 장면",
    balloons: [
      {
        id: "b1",
        type: "speech",
        tail: "SW",
        x: 0.62,
        y: 0.18,
        w: 0.34,
        h: 0.16,
        suggested_text: "",
      },
    ],
  },
  {
    index: 2,
    imageUrl: "https://placehold.co/512x512/F4F0E8/1A1A1A?text=컷+2",
    previewUrl: "https://placehold.co/512x512/F4F0E8/1A1A1A?text=컷+2",
    caption: "밖에 나갔다가 갑자기 비를 만나는 장면",
    balloons: [],
  },
  {
    index: 3,
    imageUrl: "https://placehold.co/512x512/EDE9E0/1A1A1A?text=컷+3",
    previewUrl: "https://placehold.co/512x512/EDE9E0/1A1A1A?text=컷+3",
    caption: "카페에 들어가 따뜻한 음료를 마시는 장면",
    balloons: [
      {
        id: "b2",
        type: "thought",
        tail: "S",
        x: 0.1,
        y: 0.1,
        w: 0.4,
        h: 0.2,
        suggested_text: "",
      },
    ],
  },
  {
    index: 4,
    imageUrl: "https://placehold.co/512x512/FAF7F2/FF6B6B?text=컷+4",
    previewUrl: "https://placehold.co/512x512/FAF7F2/FF6B6B?text=컷+4",
    caption: "집에 돌아와 일기를 쓰는 장면",
    balloons: [],
  },
];

export const MOCK_DIARY: Diary = {
  id: "mock-diary-001",
  userId: "mock-user-001",
  text: "오늘 퇴근길에 갑자기 비가 쏟아졌다. 우산도 없이 카페로 뛰어들어가 따뜻한 라떼 한 잔을 마셨다. 창밖으로 빗속을 걷는 사람들을 보며 오늘 하루도 수고했다고 스스로를 다독였다.",
  artStyle: "emotional_line",
  avatar: {
    preset: "SHORT_HAIR_GIRL",
    hairColor: "black",
    topStyle: "casual",
    accessory: "none",
    seed: 42,
  },
  status: "completed",
  panels: MOCK_PANELS,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_DIARY_LIST: Diary[] = [
  MOCK_DIARY,
  {
    ...MOCK_DIARY,
    id: "mock-diary-002",
    text: "주말에 오랜 친구를 만났다. 같이 공원을 걷고 옛날 이야기를 나눴다.",
    artStyle: "pop_cartoon",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    ...MOCK_DIARY,
    id: "mock-diary-003",
    text: "새로운 책을 읽기 시작했다. 첫 페이지부터 마음이 울컥했다.",
    artStyle: "watercolor_touch",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

export const MOCK_QUOTA: QuotaInfo = {
  tier: "free",
  remaining: 1,
  limit: 1,
  resetAt: new Date(Date.now() + 86400000).toISOString(),
  credits: 0,
};

export const MOCK_JOB: GenerationJob = {
  jobId: "mock-job-001",
  diaryId: "mock-diary-001",
  stage: "drawing",
  completedPanels: 2,
  totalPanels: 4,
};

/** 개발용 SSE 이벤트 시뮬레이터. 실제 EventSource를 대체. */
export function mockSSEStream(
  onEvent: (event: ToonlogSSEEvent) => void,
  delayMs = 1500
): () => void {
  const TIPS = [
    "일기 속 장면을 하나씩 그려내고 있어요...",
    "아바타의 표정을 섬세하게 다듬고 있어요.",
    "색감과 선의 흐름을 맞추는 중이에요.",
  ];

  let cancelled = false;
  let tipIndex = 0;

  const events: ToonlogSSEEvent[] = [
    { type: "status", jobId: "mock-job-001", stage: "splitting" },
    { type: "progress", jobId: "mock-job-001", completed: 0, total: 4 },
    { type: "tip", text: TIPS[0] },
    { type: "panel", jobId: "mock-job-001", panel: MOCK_PANELS[0] },
    { type: "progress", jobId: "mock-job-001", completed: 1, total: 4 },
    { type: "tip", text: TIPS[1] },
    { type: "panel", jobId: "mock-job-001", panel: MOCK_PANELS[1] },
    { type: "progress", jobId: "mock-job-001", completed: 2, total: 4 },
    { type: "tip", text: TIPS[2] },
    { type: "panel", jobId: "mock-job-001", panel: MOCK_PANELS[2] },
    { type: "progress", jobId: "mock-job-001", completed: 3, total: 4 },
    { type: "panel", jobId: "mock-job-001", panel: MOCK_PANELS[3] },
    {
      type: "done",
      jobId: "mock-job-001",
      diaryId: "mock-diary-001",
      panels: MOCK_PANELS,
    },
  ];

  let i = 0;
  function next() {
    if (cancelled || i >= events.length) return;
    onEvent(events[i++]);
    if (!cancelled && i < events.length) {
      const delay = events[i]?.type === "panel" ? delayMs * 2 : delayMs;
      setTimeout(next, delay);
    }
  }

  setTimeout(next, 500);
  return () => {
    cancelled = true;
  };
}
