export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Replied",
  "Interested",
  "Not Interested",
  "Follow-up",
  "Meeting",
  "Proposal",
  "Won",
  "Lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PIPELINE_COLUMNS: LeadStatus[] = [
  "New",
  "Contacted",
  "Replied",
  "Interested",
  "Meeting",
  "Proposal",
  "Won",
  "Lost",
];

export const STATUS_STYLES: Record<LeadStatus, { dot: string; chip: string }> = {
  New: { dot: "bg-sky-500", chip: "bg-sky-500/10 text-sky-600 dark:text-sky-300" },
  Contacted: {
    dot: "bg-violet-500",
    chip: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  Replied: {
    dot: "bg-cyan-500",
    chip: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  },
  Interested: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  "Not Interested": {
    dot: "bg-zinc-400",
    chip: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  },
  "Follow-up": {
    dot: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  Meeting: {
    dot: "bg-indigo-500",
    chip: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  },
  Proposal: {
    dot: "bg-fuchsia-500",
    chip: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300",
  },
  Won: {
    dot: "bg-green-500",
    chip: "bg-green-500/12 text-green-600 dark:text-green-300",
  },
  Lost: { dot: "bg-rose-500", chip: "bg-rose-500/10 text-rose-600 dark:text-rose-300" },
};

export const TIER_LABELS: Record<number, string> = {
  1: "Highest Priority",
  2: "Very High",
  3: "Medium",
  4: "Low",
  5: "Lowest",
};

export const TIER_STYLES: Record<number, string> = {
  1: "bg-rose-500/12 text-rose-600 dark:text-rose-300 ring-rose-500/25",
  2: "bg-orange-500/12 text-orange-600 dark:text-orange-300 ring-orange-500/25",
  3: "bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-500/25",
  4: "bg-sky-500/12 text-sky-600 dark:text-sky-300 ring-sky-500/25",
  5: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-300 ring-zinc-500/25",
};

export const ACTIVITY_TYPES = [
  "call",
  "whatsapp",
  "email",
  "meeting",
  "message",
  "other",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number] | "status" | "system";

export const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞",
  whatsapp: "💬",
  email: "✉️",
  meeting: "🤝",
  message: "📩",
  other: "•",
  status: "🔄",
  system: "⚙️",
  note: "📝",
};

export const PROJECT_STATUSES = [
  "planning",
  "in_progress",
  "review",
  "launched",
  "on_hold",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  in_progress: "In Progress",
  review: "Review",
  launched: "Launched",
  on_hold: "On Hold",
};

export type PaymentStatus = "Unpaid" | "Partially Paid" | "Paid" | "Overdue";

export const PROJECT_STAGES = [
  "Planning",
  "Design",
  "Development",
  "Content",
  "Testing",
  "Launch",
  "Completed",
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const STAGE_STYLES: Record<ProjectStage, { dot: string; chip: string }> = {
  Planning: { dot: "bg-slate-400", chip: "bg-slate-500/12 text-slate-600 dark:text-slate-300" },
  Design: { dot: "bg-fuchsia-500", chip: "bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-300" },
  Development: { dot: "bg-indigo-500", chip: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300" },
  Content: { dot: "bg-amber-500", chip: "bg-amber-500/12 text-amber-600 dark:text-amber-300" },
  Testing: { dot: "bg-cyan-500", chip: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-300" },
  Launch: { dot: "bg-orange-500", chip: "bg-orange-500/12 text-orange-600 dark:text-orange-300" },
  Completed: { dot: "bg-emerald-500", chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
};

export const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

export const TASK_STATUS_DOTS: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-indigo-500",
  review: "bg-amber-500",
  done: "bg-emerald-500",
};

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TASK_PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  medium: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  high: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  urgent: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
};

export const FILE_CATEGORIES = [
  "logo",
  "image",
  "brand",
  "content",
  "document",
  "design",
  "other",
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  logo: "Logo",
  image: "Image",
  brand: "Brand file",
  content: "Content",
  document: "Document",
  design: "Design file",
  other: "Other",
};

export type Task = {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  notes: string | null;
  position: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskWithProject = Task & {
  projectName: string | null;
  clientName: string | null;
  leadId: number | null;
};

export type ProjectNote = {
  id: number;
  projectId: number;
  body: string;
  createdAt: string;
};

export type ProjectFile = {
  id: number;
  projectId: number;
  name: string;
  mimeType: string;
  size: number;
  category: string;
  createdAt: string;
};

export type Contact = {
  id: number;
  leadId: number;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
};

export type Lead = {
  id: number;
  businessName: string;
  category: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  telegram: string | null;
  linkedin: string | null;
  leadScore: number | null;
  tier: number | null;
  status: string;
  tags: string[];
  notes: string | null;
  contactPerson: string | null;
  potentialValue: number | null;
  customFields: Record<string, string>;
  source: string | null;
  archived: boolean;
  dedupeKey: string | null;
  mapsKey: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadNote = {
  id: number;
  leadId: number;
  body: string;
  createdAt: string;
};

export type Activity = {
  id: number;
  leadId: number;
  type: string;
  summary: string;
  detail: string | null;
  occurredAt: string;
  createdAt: string;
};

export type FollowUp = {
  id: number;
  leadId: number;
  dueDate: string;
  note: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
};

export type FollowUpWithLead = FollowUp & {
  lead: Pick<
    Lead,
    "id" | "businessName" | "phone" | "category" | "city" | "tier" | "status" | "leadScore"
  > | null;
};

export type Project = {
  id: number;
  leadId: number;
  name: string;
  status: string;
  stage: string;
  progress: number;
  autoProgress: boolean;
  value: number;
  paid: number;
  dueDate: string | null;
  siteUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectWithLead = Project & {
  lead: Pick<Lead, "id" | "businessName" | "phone" | "city" | "category"> | null;
  taskTotal?: number;
  taskDone?: number;
  fileCount?: number;
  noteCount?: number;
};

export type LeadDetail = {
  lead: Lead;
  notes: LeadNote[];
  activities: Activity[];
  followUps: FollowUp[];
  projects: Project[];
};

/** Canonical importable field keys. */
export const IMPORT_FIELDS = [
  { key: "businessName", label: "Business Name", required: true },
  { key: "category", label: "Category / Niche" },
  { key: "city", label: "City / Location" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "phone2", label: "Phone 2" },
  { key: "email", label: "Email" },
  { key: "rating", label: "Rating" },
  { key: "reviewCount", label: "Review Count" },
  { key: "mapsUrl", label: "Google Maps URL" },
  { key: "website", label: "Website" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "telegram", label: "Telegram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "leadScore", label: "Lead Score (manual)" },
  { key: "tier", label: "Tier (manual)" },
  { key: "status", label: "Status" },
  { key: "tags", label: "Tags" },
  { key: "notes", label: "Notes" },
  { key: "contactPerson", label: "Contact Person" },
  { key: "potentialValue", label: "Potential Value" },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

export type ImportRow = Partial<Record<ImportFieldKey, string>> & {
  customFields?: Record<string, string>;
};

export type DuplicateInfo = {
  index: number;
  matchedBy: "maps" | "identity";
  existing: Lead;
};
