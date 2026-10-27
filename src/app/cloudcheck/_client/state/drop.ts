// src/app/cloudcheck/_client/state/drop.ts — 창 전체 dragover·drop 가로채기(리포트 유실 방지 장치 3, Q8). 소유: 페이지개발자.
// 파일을 창 아무 데나 놓으면 브라우저가 그 파일을 열어 페이지를 떠난다 → 항상 preventDefault 한다. 글자 드래그는 막지 않는다.
// 화면별 처리(읽기·V2로 이동·삼키고 안내)는 actions.windowDrop이 한다. 이 파일은 DOM 이벤트만 다룬다.
const hasFiles = (e: DragEvent): boolean => {
  const types = e.dataTransfer?.types;
  return types !== undefined && Array.from(types).includes("Files");
};

export function installWindowDrop(onFiles: (files: File[]) => void): () => void {
  const over = (e: DragEvent): void => {
    if (hasFiles(e)) e.preventDefault();
  };
  const drop = (e: DragEvent): void => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const list = e.dataTransfer?.files;
    onFiles(list === undefined ? [] : Array.from(list));
  };
  window.addEventListener("dragover", over);
  window.addEventListener("drop", drop);
  return () => {
    window.removeEventListener("dragover", over);
    window.removeEventListener("drop", drop);
  };
}
