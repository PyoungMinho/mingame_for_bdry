// src/app/cloudcheck/_client/components/dom-ids.ts — 페이지가 포커스를 옮기거나(JumpNav·[대상 n개 보기]·V4 → V3 복귀) 찾아야 하는 요소의 DOM id 규칙.
// 컴포넌트가 이 규칙대로 id를 붙인다. 제목(h2)은 tabIndex={-1}이라 focus()가 된다. 점검 id(RuleId)는 [A-Z0-9-]뿐이라 그대로 쓴다.
import type { DoorId, RuleId } from "../../../../lib/cloudcheck/model/report";

export const DOM_ID = {
  /** ScopePanel 제목(h2) */
  scope: "cc-scope-h",
  /** FirstLook 제목(h2) */
  first: "cc-first-h",
  /** ManualCheckList 제목(h2) */
  manual: "cc-manual-h",
  /** DoorSection 제목(h2) */
  door: (door: DoorId): string => `cc-door-${door}-h`,
  /** RuleRow의 <li> */
  rule: (id: RuleId): string => `cc-rule-${id}`,
  /** RuleRow의 펼침 버튼 — [대상 n개 보기]가 펼친 뒤 포커스를 준다 */
  ruleToggle: (id: RuleId): string => `cc-rule-${id}-t`,
  /** RuleRow의 [고치는 법] 버튼 — V4 → V3 복귀 때 포커스를 돌려받는다 */
  ruleFix: (id: RuleId): string => `cc-rule-${id}-fix`,
  /** FirstLook의 [고치는 법] 버튼 */
  firstFix: (id: RuleId): string => `cc-first-${id}-fix`,
  /** 입력 탭·패널(InputTabs가 붙이고, 페이지가 패널에 같은 규칙으로 붙인다) */
  inputTab: (which: "file" | "paste"): string => `cc-tab-${which}`,
  inputPanel: (which: "file" | "paste"): string => `cc-panel-${which}`,
} as const;
