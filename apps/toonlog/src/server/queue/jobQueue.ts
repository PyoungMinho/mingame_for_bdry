/**
 * 잡 큐 — tier 우선순위 + 배치 라우팅.
 * Upstash Redis 기반 + 키 없으면 in-memory 폴백.
 * Pro > Basic > Free 우선순위 (방향서 §1.3).
 */
import type { Tier } from "@/lib/contract";

export interface QueueJob {
  jobId: string;
  diaryId: string;
  userId: string;
  tier: Tier;
  /** 배치 처리 가능 여부 (예약 생성, 백필) */
  batchable: boolean;
  createdAt: number; // Date.now()
}

const TIER_PRIORITY: Record<Tier, number> = {
  pro: 3,
  basic: 2,
  free: 1,
};

/* ─── In-memory 폴백 큐 ─── */

class InMemoryQueue {
  private jobs: QueueJob[] = [];

  enqueue(job: QueueJob): void {
    this.jobs.push(job);
    // tier 우선순위 높을수록 앞으로, 동일 tier는 FIFO
    this.jobs.sort((a, b) => {
      const pa = TIER_PRIORITY[a.tier];
      const pb = TIER_PRIORITY[b.tier];
      if (pa !== pb) return pb - pa;
      return a.createdAt - b.createdAt;
    });
  }

  dequeue(): QueueJob | undefined {
    return this.jobs.shift();
  }

  size(): number {
    return this.jobs.length;
  }

  findById(jobId: string): QueueJob | undefined {
    return this.jobs.find((j) => j.jobId === jobId);
  }
}

// 싱글톤 in-memory 큐 (서버리스 환경에서는 각 요청마다 재생성될 수 있음 — 프로덕션은 Redis 필수)
const memoryQueue = new InMemoryQueue();

/* ─── Redis 큐 ─── */

async function getRedisClient() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

const QUEUE_KEY_PREFIX = "toonlog:queue:";

function getQueueKey(tier: Tier): string {
  return `${QUEUE_KEY_PREFIX}${tier}`;
}

/* ─── 공개 인터페이스 ─── */

/**
 * 잡 enqueue.
 * Redis 사용 가능 시 zadd로 tier별 sorted set에 추가.
 * 없으면 in-memory.
 */
export async function enqueueJob(job: QueueJob): Promise<void> {
  const hasRedis =
    !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!hasRedis) {
    console.warn("[Queue] Upstash 키 없음 → in-memory 큐 사용");
    memoryQueue.enqueue(job);
    return;
  }

  try {
    const redis = await getRedisClient();
    const queueKey = getQueueKey(job.tier);
    // score = createdAt (낮을수록 먼저 처리, 즉 FIFO within tier)
    await redis.zadd(queueKey, {
      score: job.createdAt,
      member: JSON.stringify(job),
    });
  } catch (err) {
    console.error("[Queue] Redis enqueue 실패 → in-memory fallback", err);
    memoryQueue.enqueue(job);
  }
}

/**
 * 큐 내 잡 예상 대기 순서 (큐 위치).
 * 프론트 대기 화면 "n번째 대기 중" 표시용.
 */
export async function getQueuePosition(jobId: string, tier: Tier): Promise<number> {
  const hasRedis =
    !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!hasRedis) {
    const job = memoryQueue.findById(jobId);
    return job ? 1 : 0; // 단순 stub
  }

  try {
    const redis = await getRedisClient();
    const queueKey = getQueueKey(tier);
    const rank = await redis.zrank(queueKey, jobId);
    return rank !== null ? rank + 1 : 0;
  } catch {
    return 1;
  }
}

export { memoryQueue };
