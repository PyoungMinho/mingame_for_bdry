// REDLINE: 타인 비교/외모 점수 UI 금지
"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePersonaStore } from "@/lib/store/persona";

// ---------------------------------------------------------------------------
// TanStack Query 설정
// ---------------------------------------------------------------------------

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1분
        gcTime: 5 * 60 * 1000, // 5분
        retry: 2,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

// ---------------------------------------------------------------------------
// 페르소나 테마 적용 컴포넌트
// ---------------------------------------------------------------------------

function PersonaThemeSync() {
  const selected = usePersonaStore((s) => s.selected);

  useEffect(() => {
    document.documentElement.setAttribute("data-persona", selected);
  }, [selected]);

  return null;
}

// ---------------------------------------------------------------------------
// 루트 Provider
// ---------------------------------------------------------------------------

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PersonaThemeSync />
      {children}
    </QueryClientProvider>
  );
}
