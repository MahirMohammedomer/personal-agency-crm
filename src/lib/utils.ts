import type { Lead } from "./types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------- money --------------------------------- */

export function formatETB(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (compact && Math.abs(value) >= 1000) {
    const units = [
      { v: 1_000_000_000, s: "B" },
      { v: 1_000_000, s: "M" },
      { v: 1_000, s: "K" },
    ];
    for (const u of units) {
      if (Math.abs(value) >= u.v) {
        const n = value / u.v;
        return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}${u.s} ETB`;
      }
    }
  }
  return `${value.toLocaleString("en-US")} ETB`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US");
}

/* ---------------------------------- dates --------------------------------- */

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

export function addDaysISO(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return `${formatDateShort(d)} · ${d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function relativeDay(dateISO: string): string {
  const today = todayISO();
  if (dateISO === today) return "Today";
  if (dateISO === addDaysISO(1)) return "Tomorrow";
  if (dateISO === addDaysISO(-1)) return "Yesterday";
  const diff = daysBetween(today, dateISO);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff <= 7) return `In ${diff}d`;
  return formatDate(`${dateISO}T00:00:00`);
}

export function daysBetween(fromISO: string, toISOStr: string): number {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISOStr}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

/* ---------------------------------- phone --------------------------------- */

/** Ethiopian-friendly phone normalization -> E.164-ish digits for tel:/wa.me links. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(/[,/;]|\s{2,}/)[0] ?? raw;
  let digits = first.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("251")) return `+${digits}`;
  if (digits.startsWith("0")) return `+251${digits.slice(1)}`;
  if (digits.length === 9 && (digits.startsWith("9") || digits.startsWith("7")))
    return `+251${digits}`;
  return digits;
}

export function telHref(phone: string | null | undefined): string | null {
  const p = normalizePhone(phone);
  return p ? `tel:${p}` : null;
}

export function whatsappHref(phone: string | null | undefined): string | null {
  const p = normalizePhone(phone);
  if (!p) return null;
  return `https://wa.me/${p.replace(/\D/g, "")}`;
}

/* ---------------------------------- links --------------------------------- */

export function ensureUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/?a|none|no|-|null)$/i.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return `https://${trimmed}`;
  return null;
}

export function socialUrl(
  platform: "facebook" | "instagram" | "tiktok" | "telegram" | "linkedin",
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || /^(n\/?a|none|no|-|null)$/i.test(v)) return null;
  const direct = ensureUrl(v);
  if (direct) return direct;
  const handle = v.replace(/^@/, "");
  switch (platform) {
    case "facebook":
      return `https://facebook.com/${handle}`;
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://tiktok.com/@${handle}`;
    case "telegram":
      return `https://t.me/${handle}`;
    case "linkedin":
      return `https://linkedin.com/company/${handle}`;
  }
}

export function mapsHref(lead: Pick<Lead, "mapsUrl" | "businessName" | "address">): string | null {
  const direct = ensureUrl(lead.mapsUrl);
  if (direct) return direct;
  const q = [lead.businessName, lead.address].filter(Boolean).join(" ");
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function hasSocial(lead: Lead): boolean {
  return Boolean(
    socialUrl("facebook", lead.facebook) ||
      socialUrl("instagram", lead.instagram) ||
      socialUrl("tiktok", lead.tiktok) ||
      socialUrl("telegram", lead.telegram) ||
      socialUrl("linkedin", lead.linkedin),
  );
}

/* ------------------------------- copy helper ------------------------------ */

export function buildLeadInfoText(
  lead: Lead,
  extras?: {
    contacts?: Array<{ name: string; role: string | null; phone: string | null; email: string | null }>;
    notes?: string[];
    projects?: Array<{ name: string; stage: string; progress: number; value: number; paid: number }>;
  },
): string {
  const lines: string[] = [lead.businessName];
  const push = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    lines.push(`${label}: ${value}`);
  };
  push("Category", lead.category);
  push("Location", lead.city);
  push("Address", lead.address);
  push("Contact", lead.contactPerson);
  push("Phone", lead.phone);
  push("Phone 2", lead.phone2);
  push("Email", lead.email);
  push("Rating", lead.rating);
  push("Reviews", lead.reviewCount);
  lines.push(`Website: ${ensureUrl(lead.website) ?? "None"}`);
  push("Google Maps", mapsHref(lead));
  push("Facebook", socialUrl("facebook", lead.facebook));
  push("Instagram", socialUrl("instagram", lead.instagram));
  push("TikTok", socialUrl("tiktok", lead.tiktok));
  push("Telegram", socialUrl("telegram", lead.telegram));
  push("LinkedIn", socialUrl("linkedin", lead.linkedin));
  push("Lead Score", lead.leadScore);
  push("Tier", lead.tier ? `Tier ${lead.tier}` : null);
  push("Status", lead.status);
  if (lead.tags?.length) push("Tags", lead.tags.join(", "));
  push("Potential Value", lead.potentialValue ? `${formatETB(lead.potentialValue)}` : null);
  for (const [k, v] of Object.entries(lead.customFields ?? {})) push(k, v);

  if (extras?.contacts?.length) {
    lines.push("", "Contacts:");
    for (const c of extras.contacts) {
      lines.push(
        `- ${c.name}${c.role ? ` — ${c.role}` : ""}${c.phone ? ` · ${c.phone}` : ""}${
          c.email ? ` · ${c.email}` : ""
        }`,
      );
    }
  }
  if (extras?.projects?.length) {
    lines.push("", "Projects:");
    for (const p of extras.projects) {
      lines.push(
        `- ${p.name} · ${p.stage} · ${p.progress}% · ${formatETB(p.paid)} of ${formatETB(p.value)} paid`,
      );
    }
  }
  const noteLines = [lead.notes, ...(extras?.notes ?? [])].filter(Boolean) as string[];
  if (noteLines.length) {
    lines.push("", "Notes:");
    for (const n of noteLines.slice(0, 8)) lines.push(n);
  }
  return lines.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* -------------------------------- dedupe ---------------------------------- */

export function normalizeMapsKey(url: string | null | undefined): string | null {
  const u = ensureUrl(url ?? null);
  if (!u) return null;
  const lower = u.toLowerCase();
  const cid = lower.match(/[?&]cid=(\d+)/)?.[1];
  if (cid) return `cid:${cid}`;
  const placeId = lower.match(/[?&]place_id=([\w-]+)/)?.[1];
  if (placeId) return `pid:${placeId}`;
  const hex = lower.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/)?.[1];
  if (hex) return `ftid:${hex}`;
  const place = lower.match(/\/maps\/place\/([^/?#]+)/)?.[1];
  if (place) return `place:${decodeURIComponent(place).replace(/\+/g, " ").trim()}`;
  return `url:${lower.replace(/[?#].*$/, "").replace(/\/$/, "")}`;
}

function slug(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\u1200-\u137f]+/g, "")
    .trim();
}

export function buildDedupeKey(input: {
  businessName?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
}): string {
  const name = slug(input.businessName);
  const phone = (normalizePhone(input.phone) ?? "").replace(/\D/g, "").slice(-9);
  const place = slug(input.address ?? input.city ?? "").slice(0, 24);
  return `${name}|${phone}|${place}`;
}

/* ------------------------------ misc helpers ------------------------------ */

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function avatarGradient(seed: string): string {
  const palettes = [
    "from-indigo-500/85 to-violet-500/85",
    "from-emerald-500/85 to-teal-500/85",
    "from-amber-500/85 to-orange-500/85",
    "from-sky-500/85 to-cyan-500/85",
    "from-rose-500/85 to-pink-500/85",
    "from-fuchsia-500/85 to-purple-500/85",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return palettes[hash % palettes.length];
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export function fileIcon(mimeType: string, name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType.startsWith("image/")) return "🖼";
  if (mimeType === "application/pdf" || ext === "pdf") return "📕";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "📘";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
  if (["ppt", "pptx"].includes(ext)) return "📙";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜";
  if (["ai", "psd", "fig", "sketch", "xd"].includes(ext)) return "🎨";
  if (["mp4", "mov", "avi", "webm"].includes(ext)) return "🎬";
  if (["ttf", "otf", "woff", "woff2"].includes(ext)) return "🔤";
  return "📄";
}

export function buildProjectInfoText(input: {
  project: {
    name: string;
    stage: string;
    progress: number;
    value: number;
    paid: number;
    dueDate: string | null;
    siteUrl: string | null;
  };
  clientName?: string | null;
  clientPhone?: string | null;
  taskTotal?: number;
  taskDone?: number;
  notes?: string[];
}): string {
  const { project } = input;
  const lines: string[] = [project.name];
  if (input.clientName) lines.push(`Client: ${input.clientName}`);
  if (input.clientPhone) lines.push(`Phone: ${input.clientPhone}`);
  lines.push(`Stage: ${project.stage}`);
  lines.push(`Progress: ${project.progress}%`);
  if (project.dueDate) lines.push(`Deadline: ${formatDate(`${project.dueDate}T00:00:00`)}`);
  if (input.taskTotal !== undefined) {
    lines.push(
      `Tasks: ${input.taskDone ?? 0}/${input.taskTotal} done · ${
        (input.taskTotal ?? 0) - (input.taskDone ?? 0)
      } remaining`,
    );
  }
  lines.push(`Value: ${formatETB(project.value)}`);
  lines.push(`Paid: ${formatETB(project.paid)}`);
  lines.push(`Remaining: ${formatETB(Math.max(project.value - project.paid, 0))}`);
  lines.push(`Payment status: ${paymentStatus(project.value, project.paid, project.dueDate)}`);
  if (project.siteUrl) lines.push(`Live site: ${project.siteUrl}`);
  if (input.notes?.length) {
    lines.push("", "Notes:");
    for (const note of input.notes.slice(0, 5)) lines.push(`- ${note}`);
  }
  return lines.join("\n");
}

export function paymentStatus(
  value: number,
  paid: number,
  dueDate: string | null,
): "Unpaid" | "Partially Paid" | "Paid" | "Overdue" {
  if (value > 0 && paid >= value) return "Paid";
  const overdue = dueDate ? daysBetween(todayISO(), dueDate) < 0 : false;
  if (overdue && paid < value) return "Overdue";
  if (paid > 0) return "Partially Paid";
  return "Unpaid";
}
