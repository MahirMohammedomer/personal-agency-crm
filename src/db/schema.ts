import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    businessName: text("business_name").notNull(),
    category: text("category"),
    address: text("address"),
    city: text("city"),
    phone: text("phone"),
    phone2: text("phone2"),
    email: text("email"),
    rating: real("rating"),
    reviewCount: integer("review_count"),
    mapsUrl: text("maps_url"),
    website: text("website"),
    facebook: text("facebook"),
    instagram: text("instagram"),
    tiktok: text("tiktok"),
    telegram: text("telegram"),
    linkedin: text("linkedin"),
    // Manual values — the app never computes or mutates these automatically.
    leadScore: integer("lead_score"),
    tier: integer("tier"),
    status: text("status").notNull().default("New"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    contactPerson: text("contact_person"),
    potentialValue: integer("potential_value"),
    customFields: jsonb("custom_fields")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    source: text("source"),
    archived: boolean("archived").notNull().default(false),
    dedupeKey: text("dedupe_key"),
    mapsKey: text("maps_key"),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("leads_status_idx").on(table.status),
    index("leads_tier_idx").on(table.tier),
    index("leads_dedupe_idx").on(table.dedupeKey),
    index("leads_maps_idx").on(table.mapsKey),
  ],
);

export const leadNotes = pgTable(
  "lead_notes",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("lead_notes_lead_idx").on(table.leadId)],
);

export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    // call | whatsapp | email | meeting | message | other | status | system
    type: text("type").notNull().default("other"),
    summary: text("summary").notNull(),
    detail: text("detail"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("activities_lead_idx").on(table.leadId)],
);

export const followUps = pgTable(
  "follow_ups",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    dueDate: text("due_date").notNull(), // YYYY-MM-DD, local to the user
    note: text("note"),
    // pending | done | cancelled
    status: text("status").notNull().default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("follow_ups_lead_idx").on(table.leadId),
    index("follow_ups_due_idx").on(table.dueDate),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // planning | in_progress | review | launched | on_hold
    status: text("status").notNull().default("planning"),
    // Planning | Design | Development | Content | Testing | Launch | Completed
    stage: text("stage").notNull().default("Planning"),
    progress: integer("progress").notNull().default(0),
    autoProgress: boolean("auto_progress").notNull().default(true),
    value: integer("value").notNull().default(0),
    paid: integer("paid").notNull().default(0),
    dueDate: text("due_date"),
    siteUrl: text("site_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("projects_lead_idx").on(table.leadId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // todo | in_progress | review | done
    status: text("status").notNull().default("todo"),
    // low | medium | high | urgent
    priority: text("priority").notNull().default("medium"),
    dueDate: text("due_date"),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tasks_project_idx").on(table.projectId),
    index("tasks_due_idx").on(table.dueDate),
  ],
);

export const projectNotes = pgTable(
  "project_notes",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("project_notes_project_idx").on(table.projectId)],
);

export const projectFiles = pgTable(
  "project_files",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    size: integer("size").notNull().default(0),
    // logo | image | brand | content | document | design | other
    category: text("category").notNull().default("other"),
    data: text("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("project_files_project_idx").on(table.projectId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role"),
    phone: text("phone"),
    email: text("email"),
    isPrimary: boolean("is_primary").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("contacts_lead_idx").on(table.leadId)],
);

export const owner = pgTable("owner", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  resetToken: text("reset_token"),
  resetExpiresAt: timestamp("reset_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadNote = typeof leadNotes.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ProjectNote = typeof projectNotes.$inferSelect;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Owner = typeof owner.$inferSelect;
