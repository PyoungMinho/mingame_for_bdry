"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * 전역 클라이언트 프로바이더.
 * - TanStack Query v5 (서버 상태)
 * - Zustand는 store 단위로 직접 사용하므로 별도 Provider 불필요
 * 페이지개발자: 토스트/모달 포털 등 전역 UI 프로바이더가 필요하면 여기에 합성한다.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
