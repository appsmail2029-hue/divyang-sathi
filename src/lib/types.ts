export type Role = "admin" | "station";

export type Direction = "+" | "-";

export type AssistanceType = "VISUALLY_IMPAIRED" | "WHEELCHAIR";

export type RequestStatus =
  | "PENDING"
  | "ACKNOWLEDGED"
  | "DEPARTED"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "COMPLETED";

export type InfoCategory = "LOST_FOUND" | "SEPARATE_PASSENGER" | "OTHER";

export type NotificationPriority = "NORMAL" | "HIGH" | "CRITICAL";

export type NotificationStatus = "UNREAD" | "READ" | "SILENCED";

export const DIRECTION_LABEL: Record<Direction, string> = {
  "+": "+ Circular",
  "-": "- Circular",
};

export const ASSISTANCE_LABEL: Record<AssistanceType, string> = {
  VISUALLY_IMPAIRED: "Visually Impaired",
  WHEELCHAIR: "Wheelchair",
};

export const INFO_LABEL: Record<InfoCategory, string> = {
  LOST_FOUND: "Lost & Found",
  SEPARATE_PASSENGER: "Separate Passenger",
  OTHER: "Other",
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: "Pending",
  ACKNOWLEDGED: "Acknowledged",
  DEPARTED: "Train Departed",
  IN_TRANSIT: "In Transit",
  ARRIVED: "Arrived",
  COMPLETED: "Completed",
};

export interface Station {
  id: number;
  code: string;
  name: string;
  active: boolean;
  plusSeq: number | null;
  minusSeq: number | null;
}

export interface StationOption {
  id: number;
  code: string;
  name: string;
}

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  stationId: number | null;
  stationName: string | null;
  stationCode: string | null;
}

export interface TrainMovement {
  id: number;
  requestId: string;
  stationId: number;
  stationName: string;
  offset: number;
  updatedBy: string;
  createdAt: string;
}

export interface Acknowledgement {
  action: "ACKNOWLEDGED" | "COMPLETED";
  stationName: string;
  userName: string;
  createdAt: string;
}

export interface JourneyStation {
  id: number;
  code: string;
  name: string;
  offset: number;
  isBoarding: boolean;
  isDestination: boolean;
}

export interface AssistanceRequest {
  requestCode: string;
  assistanceType: AssistanceType;
  boardingStationId: number;
  boardingStation: string;
  destinationStationId: number;
  destinationStation: string;
  passengerCount: number;
  trainNumber: string;
  trainSet: string;
  direction: Direction;
  status: RequestStatus;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  departedAt: string | null;
  currentStationId: number | null;
  currentStation: string | null;
  currentOffset: number;
  totalStations: number;
  remainingStations: number;
  secondAlarmSent: boolean;
  estimatedArrivalAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdBy: string;
  movements?: TrainMovement[];
  acknowledgements?: Acknowledgement[];
  journey?: JourneyStation[];
}

export interface OtherInfo {
  infoCode: string;
  category: InfoCategory;
  description: string;
  originStationId: number;
  originStation: string;
  imageUrl: string | null;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  closedAt: string | null;
  createdBy: string;
  acknowledgedStations: number;
  acknowledgedByMe: boolean;
  acknowledgedStationNames?: string[];
}

export interface NotificationItem {
  id: number;
  kind: string;
  priority: NotificationPriority;
  title: string;
  body: string;
  stationId: number | null;
  requestId: string | null;
  infoId: string | null;
  status: NotificationStatus;
  createdAt: string;
  readAt: string | null;
}

export interface DashboardData {
  stats: {
    totalRequests: number;
    pending: number;
    acknowledged: number;
    approaching: number;
    completed: number;
    activeNotices: number;
  };
  requests: AssistanceRequest[];
  notices: OtherInfo[];
  notifications: NotificationItem[];
  settings: AppSettings;
  serverTime: string;
}

export interface UserRecord {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  stationId: number | null;
  stationName: string | null;
  active: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  actorName: string;
  stationName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

export interface AdminOverview {
  stations: { total: number; active: number };
  users: { total: number; active: number; admins: number };
  requests: {
    total: number;
    active: number;
    pending: number;
    completed: number;
    today: number;
  };
  info: { open: number; total: number };
  recentRequests: AssistanceRequest[];
  recentAudit: AuditLog[];
  directionSummary: { plus: number; minus: number };
}

export interface ReportRow {
  key: string;
  label: string;
  visuallyImpaired: number;
  wheelchair: number;
  total: number;
  completed: number;
  pending: number;
  avgAckMinutes: number | null;
  avgCompleteMinutes: number | null;
}

export interface ReportPayload {
  range: "daily" | "weekly" | "monthly";
  from: string;
  to: string;
  summary: {
    total: number;
    completed: number;
    active: number;
    visuallyImpaired: number;
    wheelchair: number;
    avgAckMinutes: number | null;
    avgCompleteMinutes: number | null;
  };
  series: { label: string; total: number; completed: number; visuallyImpaired: number; wheelchair: number }[];
  stationWise: ReportRow[];
}

export interface AppSettings {
  secondsPerStation: number;
  alarmVolume: number;
  alarmRepeatSeconds: number;
  browserNotifications: boolean;
  pushEnabled: boolean;
  autoCloseNoticeDays: number;
  demoMode: boolean;
  organizationName: string;
}
