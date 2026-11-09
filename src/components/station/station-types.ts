import type { ToastKind } from "@/components/ui";

export type StationTab = "overview" | "requests" | "tracking" | "info" | "notifications";

export interface StationApi {
  acknowledge: (code: string) => Promise<void>;
  silence: (code: string) => Promise<void>;
  depart: (code: string) => Promise<void>;
  complete: (code: string) => Promise<void>;
  openDetail: (code: string) => void;
  openLocationUpdate: (code: string) => void;
  openRequestForm: (type: "VISUALLY_IMPAIRED" | "WHEELCHAIR") => void;
  openInfo: () => void;
  openTab: (tab: StationTab) => void;
}

export type PushToast = (kind: ToastKind, message: string) => void;
