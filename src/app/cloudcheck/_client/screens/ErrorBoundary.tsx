// src/app/cloudcheck/_client/screens/ErrorBoundary.tsx — 예상 못 한 렌더 오류의 안전망. 소유: 페이지개발자.
// 화면 하나가 던진 오류로 앱 전체가 빈 화면이 되지 않게, 오류가 나면 main.tsx가 정적 셸(V0 머리 + 부팅 대체 안내 + 오프라인판 링크)을 되살린다.
// 새 문구를 만들지 않는다: 되살린 정적 셸의 안내(cc.boot.failed)와 오프라인판 링크가 그대로 쓰인다. 오류 내용(사용자 데이터가 섞일 수 있다)은 어디에도 남기지 않는다.
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  readonly onFatal: () => void;
  readonly children: ReactNode;
}

export class ErrorBoundary extends Component<Props, { readonly failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    this.props.onFatal();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
