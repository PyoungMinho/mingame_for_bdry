// src/lib/cloudcheck/parse/scan.ts — JSON 깊이 스캔 · 문법 오류 위치 (방향서 §4-5 ④, 디자인 B3·B9)
// JSON.parse의 오류 메시지는 엔진마다 다르다(위치가 없거나 형식이 제각각) → 첫 오류 위치를 직접 찾는다. 같은 입력이면 어느 브라우저에서나 같은 줄·칸이 나온다.

/** 중첩 깊이를 반복문으로 센다(재귀 없음 · 문자열 안의 괄호는 무시). limit을 넘으면 바로 멈춘다 */
export function maxJsonDepth(text: string, limit: number): { depth: number; exceeded: boolean } {
  let depth = 0, max = 0, inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") { depth++; if (depth > max) max = depth; if (max > limit) return { depth: max, exceeded: true }; }
    else if (c === "}" || c === "]") { if (depth > 0) depth--; }
  }
  return { depth: max, exceeded: false };
}

/** 문자 위치(0부터) → 줄·칸(1부터) */
export function locate(text: string, pos: number): { line: number; col: number } {
  let line = 1, last = -1;
  const stop = Math.min(pos, text.length);
  for (let i = 0; i < stop; i++) if (text.charCodeAt(i) === 10) { line++; last = i; }
  return { line, col: stop - last };
}

/**
 * JSON 문법 검사: 첫 오류의 위치(문자 인덱스)를 돌려주고, 올바르면 null. 입력 끝에서 끊기면 position = text.length (잘림).
 * 재귀 깊이는 호출 전에 maxJsonDepth로 제한된 입력에만 쓴다(깊이 32 이하).
 */
export function jsonSyntaxError(text: string): number | null {
  let i = 0;
  const n = text.length;
  let err: number | null = null;
  const fail = (at: number): false => { if (err === null) err = at; return false; };
  const ws = (): void => { while (i < n && (text[i] === " " || text[i] === "\t" || text[i] === "\n" || text[i] === "\r")) i++; };
  const str = (): boolean => {
    i++;   // opening quote
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 34) { i++; return true; }
      if (c < 0x20) return fail(i);
      if (c === 92) {
        const e = text[i + 1];
        if (e === undefined) return fail(n);
        if (e === "u") { if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) return fail(Math.min(i + 2, n)); i += 6; continue; }
        if (!'"\\/bfnrt'.includes(e)) return fail(i + 1);
        i += 2; continue;
      }
      i++;
    }
    return fail(n);
  };
  const num = (): boolean => {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i, i + 400));
    if (!m) return fail(i);
    i += m[0].length;
    return true;
  };
  const lit = (word: string): boolean => { if (text.startsWith(word, i)) { i += word.length; return true; } return fail(word.startsWith(text.slice(i)) ? n : i); };
  const val = (depth: number): boolean => {
    ws();
    if (i >= n) return fail(n);
    if (depth > 64) return fail(i);
    const c = text[i];
    if (c === "{") {
      i++; ws();
      if (text[i] === "}") { i++; return true; }
      for (;;) {
        ws();
        if (i >= n) return fail(n);
        if (text[i] !== '"') return fail(i);
        if (!str()) return false;
        ws();
        if (i >= n) return fail(n);
        if (text[i] !== ":") return fail(i);
        i++;
        if (!val(depth + 1)) return false;
        ws();
        if (i >= n) return fail(n);
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "}") { i++; return true; }
        return fail(i);
      }
    }
    if (c === "[") {
      i++; ws();
      if (text[i] === "]") { i++; return true; }
      for (;;) {
        if (!val(depth + 1)) return false;
        ws();
        if (i >= n) return fail(n);
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "]") { i++; return true; }
        return fail(i);
      }
    }
    if (c === '"') return str();
    if (c === "t") return lit("true");
    if (c === "f") return lit("false");
    if (c === "n") return lit("null");
    if (c === "-" || (c >= "0" && c <= "9")) return num();
    return fail(i);
  };
  if (!val(0)) return err;
  ws();
  if (i < n) return i;
  return null;
}
