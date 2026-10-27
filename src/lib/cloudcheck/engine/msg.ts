// src/lib/cloudcheck/engine/msg.ts — 메시지 코드 + 파라미터 생성(엔진·룰 공용, 문장 없음)
import type { MessageCode, MsgRef } from "../model/report";
import type { RMsg, RParams } from "./types";

/** 룰 쪽 메시지(사용자 데이터는 Raw로). core가 MsgRef로 바꾼다 */
export function msg<C extends MessageCode>(code: C, params?: RParams): RMsg<C> {
  return params === undefined ? { code } : { code, params };
}

/** 파라미터가 없는 완성된 Report 메시지 */
export const ref = <C extends MessageCode>(code: C): MsgRef<C> => ({ code });
