import { create } from "zustand";

import type { PendingRequest } from "../types";

interface PendingRequestState {
  requests: PendingRequest[];
  setRequests : (newRequests: PendingRequest[]) => void;
  onRemovePendingRequest : (requestId: string) => void;
}

export const usePendingRequest = create<PendingRequestState>((set) => ({
  requests: [],
  setRequests: (newRequests: PendingRequest[]) =>
    set({ requests: newRequests }),
  onRemovePendingRequest: (requestId: string) =>
    set((state) => ({
      requests: state.requests.filter((req) => req.id !== requestId),
    })),
}));
