'use client';

/**
 * 탭 제목 고정 (디자인 §9-7, 방향서 §8-2 #1).
 *  - 홈 `월마감`, 연습 `연습용_사본_v1`, 방 = 업종 파일명(`v{n}`, 재대결이면 v8).
 *  - 숨기기·차례 변경·경보에도 불변. 제목 알림("(1)", "내 차례") 금지.
 *  - `<head>`(그 안의 `<title>` 교체·글자 변경)를 MutationObserver로 감시해 다른 코드가 바꾸면 다시 덮는다(루트 레이아웃 접미사 등).
 *  - 파비콘은 layout 메타가 정한다(숨기기 전후 동일).
 */

import { useEffect } from 'react';

export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (!title) return;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    // <head> 전체를 본다: <title> 요소가 통째로 교체돼도(클라 이동 시 head 갱신) 새 요소의 글자 변경까지 잡는다(BUG-08).
    // 예전에는 처음 찾은 <title>만 봐서 교체 뒤에는 감시가 끊겼다. apply는 같으면 쓰지 않으므로 되먹임 고리가 없다.
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, [title]);
}
