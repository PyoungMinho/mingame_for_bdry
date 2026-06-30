"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { ReportSheet } from "@/components/report/ReportSheet";
import { useReportMutation } from "@/lib/api/listings";
import type { ReportPayload } from "@/lib/types/domain";

interface ReportButtonProps {
  listingId: string;
  listingTitle: string;
}

export function ReportButton({ listingId, listingTitle }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const { mutateAsync, isPending } = useReportMutation();

  async function handleSubmit(report: ReportPayload) {
    await mutateAsync(report);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="flex items-center gap-1.5 text-sm text-realestate-neutral-500 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary rounded"
      >
        <Flag size={14} strokeWidth={1.5} aria-hidden="true" />
        허위매물 신고
      </button>
      <ReportSheet
        listingId={listingId}
        listingTitle={listingTitle}
        open={open}
        onOpenChange={setOpen}
        onSubmit={handleSubmit}
      />
    </>
  );
}
