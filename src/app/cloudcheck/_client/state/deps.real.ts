// src/app/cloudcheck/_client/state/deps.real.ts — 실제 엔진·파서를 EngineDeps에 연결한다(방향서 §5-3, 통합 D4). 소유: 페이지개발자 → 통합은 프론트팀장.
// 열 모듈은 모두 _client → lib import 허용 목록 안이다(parse/recognize·normalize·mask·exceptions, engine/judge·time·exceptions·compare, rules/catalog·version).
// main.tsx가 이 파일을 쓴다(D4 통합에서 deps.unwired → deps.real). 번들 입력에 이 파일이 있고 목업이 없는지는 _build/generated.test.ts가 본다.
import { compare } from "../../../../lib/cloudcheck/engine/compare";
import { overlayExceptions } from "../../../../lib/cloudcheck/engine/exceptions";
import { judge } from "../../../../lib/cloudcheck/engine/judge";
import { timeNotices } from "../../../../lib/cloudcheck/engine/time";
import { parseExceptions, serializeExceptions } from "../../../../lib/cloudcheck/parse/exceptions";
import { maskedCopy } from "../../../../lib/cloudcheck/parse/mask";
import { buildInput } from "../../../../lib/cloudcheck/parse/normalize";
import { recognize } from "../../../../lib/cloudcheck/parse/recognize";
import { RULE_CATALOG } from "../../../../lib/cloudcheck/rules/catalog";
import { RULESET_VERSION } from "../../../../lib/cloudcheck/rules/version";
import type { EngineDeps } from "./deps";

export const REAL_DEPS: EngineDeps = {
  recognize,
  buildInput,
  judge,
  timeNotices,
  overlayExceptions,
  compare,
  maskedCopy,
  parseExceptions,
  serializeExceptions,
  catalog: RULE_CATALOG,
  rulesetVersion: RULESET_VERSION,
};
