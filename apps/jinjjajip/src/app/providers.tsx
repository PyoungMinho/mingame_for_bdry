"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
            // BUG-01 fix: 기본 networkMode("online")은 오프라인/요청실패 시
            // fetchStatus="paused" + status="pending" 로 멈춰 isError 분기를 우회한다.
            // → 검색홈이 에러 대신 EmptyState 를 잘못 노출(ST-05). "always" 로 강제하여
            //    실패가 즉시 error 로 표면화되도록 한다.
            networkMode: "always",
          },
          mutations: {
            networkMode: "always",
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
