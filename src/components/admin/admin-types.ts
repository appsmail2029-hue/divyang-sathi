import type { ToastKind } from "@/components/ui";
import type { InfoCategory } from "@/lib/types";

export type AdminTab =
  | "overview"
  | "stations"
  | "routes"
  | "users"
  | "requests"
  | "notices"
  | "reports"
  | "settings"
  | "audit"
  | "export";

export interface AdminStation {
  id: number;
  code: string;
  name: string;
  active: boolean;
  plusSeq: number | null;
  minusSeq: number | null;
  userCount: number;
}

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "station";
  stationId: number | null;
  stationName: string | null;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AdminNotice {
  infoCode: string;
  category: InfoCategory;
  description: string;
  originStation: string;
  imageUrl: string | null;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  closedAt: string | null;
  createdBy: string;
  acknowledgedStations: number;
  acknowledgedStationNames: string[];
}

export interface AdminApi {
  version: number;
  refresh: () => void;
  notify: (kind: ToastKind, message: string) => void;
  setTab: (tab: AdminTab) => void;
}
