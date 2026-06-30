import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UploadResult } from "@/lib/types/domain";

export type UploadStep = 1 | 2 | 3 | 4 | 5;

interface UploadState {
  currentStep: UploadStep;
  listingId: string | null;
  uploadId: string | null;
  uploadResult: UploadResult | null;
  passToken: string | null;
  consentCompleted: boolean;
  setStep: (step: UploadStep) => void;
  setListingId: (id: string) => void;
  setUploadId: (id: string) => void;
  setUploadResult: (result: UploadResult) => void;
  setPassToken: (token: string) => void;
  setConsentCompleted: (completed: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 1 as UploadStep,
  listingId: null,
  uploadId: null,
  uploadResult: null,
  passToken: null,
  consentCompleted: false,
};

export const useUploadStore = create<UploadState>()(
  persist(
    (set) => ({
      ...initialState,
      setStep: (step) => set({ currentStep: step }),
      setListingId: (id) => set({ listingId: id }),
      setUploadId: (id) => set({ uploadId: id }),
      setUploadResult: (result) => set({ uploadResult: result }),
      setPassToken: (token) => set({ passToken: token }),
      setConsentCompleted: (completed) => set({ consentCompleted: completed }),
      reset: () => set(initialState),
    }),
    {
      name: "jinjjajip-upload",
      partialize: (state) => ({
        currentStep: state.currentStep,
        listingId: state.listingId,
        uploadId: state.uploadId,
        passToken: state.passToken,
        consentCompleted: state.consentCompleted,
      }),
    },
  ),
);
