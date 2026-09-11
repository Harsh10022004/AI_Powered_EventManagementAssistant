export type Category =
  | "venue" | "catering" | "decor" | "photography" | "entertainment"
  | "accommodation" | "transportation" | "invitations" | "branding"
  | "team_building" | "leadership_session" | "other";

export interface EventDoc {
  _id: string;
  title: string;
  type: "wedding" | "corporate" | "other";
  startDate: string | null;
  endDate: string | null;
  guestCount: number;
  guestTravelCount: number;
  subEvents: { name: string; date?: string }[];
  status: "planning" | "active" | "completed";
  notes: string[];
  createdAt: string;
}

export interface Task {
  _id: string;
  event: string;
  title: string;
  category: Category;
  subEvent: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "critical";
  dueDate: string | null;
  assignee: string | null;
  dependsOn: string | null;
  notes: string;
  createdBy: "ai" | "manual";
  createdAt: string;
}

export interface Vendor {
  _id: string;
  event: string;
  name: string;
  category: Category;
  status: "not_started" | "contacted" | "negotiating" | "confirmed" | "cancelled";
  capacity: number | null;
  contact: string;
  notes: string;
  createdAt: string;
}

export interface Risk {
  _id: string;
  event: string;
  type: "capacity_mismatch" | "deadline_risk" | "missing_vendor" | "dependency_block" | "scheduling_conflict" | "other";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  suggestedAction: string;
  relatedTask: string | null;
  relatedVendor: string | null;
  status: "open" | "acknowledged" | "resolved";
  source: "rule_engine" | "ai";
  createdAt: string;
}

export interface Message {
  _id: string;
  event: string;
  role: "user" | "assistant";
  text: string;
  actionsSummary?: {
    tasksCreated: number; tasksUpdated: number;
    vendorsCreated: number; vendorsUpdated: number; risksRaised: number;
  };
  createdAt: string;
}

export interface DashboardStats {
  totalTasks: number;
  doneTasks: number;
  completionPct: number;
  openRisks: number;
  criticalRisks: number;
  confirmedVendors: number;
  totalVendors: number;
  daysToEvent: number | null;
}

export interface DashboardSnapshot {
  event: EventDoc;
  tasks: Task[];
  vendors: Vendor[];
  risks: Risk[];
  messages: Message[];
  stats: DashboardStats;
}
