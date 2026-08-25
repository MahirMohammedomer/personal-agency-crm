"use client";

import type { Lead } from "./types";

export const LEAD_EXPORT_COLUMNS: Array<{ key: keyof Lead | "customFields"; label: string }> = [
  { key: "businessName", label: "Business Name" },
  { key: "category", label: "Category" },
  { key: "city", label: "City" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "phone2", label: "Phone 2" },
  { key: "email", label: "Email" },
  { key: "contactPerson", label: "Contact Person" },
  { key: "rating", label: "Rating" },
  { key: "reviewCount", label: "Reviews" },
  { key: "website", label: "Website" },
  { key: "mapsUrl", label: "Google Maps URL" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "telegram", label: "Telegram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "leadScore", label: "Lead Score" },
  { key: "tier", label: "Tier" },
  { key: "status", label: "Status" },
  { key: "tags", label: "Tags" },
  { key: "potentialValue", label: "Potential Value" },
  { key: "notes", label: "Notes" },
  { key: "source", label: "Source" },
  { key: "createdAt", label: "Created At" },
];

export function leadsToRows(items: Lead[]): Array<Record<string, string | number>> {
  return items.map((lead) => {
    const row: Record<string, string | number> = {};
    for (const col of LEAD_EXPORT_COLUMNS) {
      const value = lead[col.key as keyof Lead];
      if (Array.isArray(value)) row[col.label] = value.join(", ");
      else if (value === null || value === undefined) row[col.label] = "";
      else if (typeof value === "object") row[col.label] = JSON.stringify(value);
      else row[col.label] = value as string | number;
    }
    for (const [key, value] of Object.entries(lead.customFields ?? {})) {
      row[key] = value;
    }
    return row;
  });
}

export function toCSV(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV(rows: Array<Record<string, unknown>>, filename: string) {
  downloadBlob(`\uFEFF${toCSV(rows)}`, filename, "text/csv;charset=utf-8;");
}

export async function downloadXLSX(
  sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>,
  filename: string,
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadBlob(
    out,
    filename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

export function downloadJSON(data: unknown, filename: string) {
  downloadBlob(JSON.stringify(data, null, 2), filename, "application/json");
}

export function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}
