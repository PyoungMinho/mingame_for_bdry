// 프론트 → /api/moira/compute 호출 헬퍼.
// live 시나리오면 반환, demo/error/실패면 null → 호출부가 시드(buildScenario)로 폴백.

import type { Scenario } from "./scenario";

export interface LiveMember {
  id?: string;
  name: string;
  avatar?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export async function fetchLiveScenario(members: LiveMember[]): Promise<Scenario | null> {
  try {
    const res = await fetch("/api/moira/compute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ members }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { mode?: string; scenario?: Scenario | null } };
    return json?.data?.mode === "live" && json.data.scenario ? json.data.scenario : null;
  } catch {
    return null;
  }
}
