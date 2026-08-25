"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Label, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPut } from "@/lib/api";
import {
  downloadCSV,
  downloadJSON,
  downloadXLSX,
  leadsToRows,
  stamp,
} from "@/lib/export-client";
import type { Lead } from "@/lib/types";

type Settings = {
  customFields: string[];
  tagPresets: string[];
  prefs: { currency?: string; defaultProjectValue?: number };
};

type Backup = {
  leads: Lead[];
  notes: unknown[];
  activities: unknown[];
  followUps: unknown[];
  projects: unknown[];
  tasks: unknown[];
  projectNotes: unknown[];
  contacts: unknown[];
  files: unknown[];
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newField, setNewField] = useState("");
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ settings: Settings }>("/api/settings");
      setSettings(data.settings);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<Settings>) => {
    setSaving(true);
    try {
      const data = await apiPut<{ settings: Settings }>("/api/settings", patch);
      setSettings(data.settings);
      toast("Settings saved", "success");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const exportAll = async (format: "json" | "xlsx") => {
    setBusy(format);
    try {
      const data = await apiGet<Backup>("/api/export?scope=all");
      if (format === "json") {
        downloadJSON(data, `meda-crm-backup-${stamp()}.json`);
      } else {
        await downloadXLSX(
          [
            { name: "Leads", rows: leadsToRows(data.leads) },
            { name: "Notes", rows: data.notes as Array<Record<string, unknown>> },
            { name: "Activities", rows: data.activities as Array<Record<string, unknown>> },
            { name: "FollowUps", rows: data.followUps as Array<Record<string, unknown>> },
            { name: "Projects", rows: data.projects as Array<Record<string, unknown>> },
            { name: "Tasks", rows: data.tasks as Array<Record<string, unknown>> },
            { name: "ProjectNotes", rows: data.projectNotes as Array<Record<string, unknown>> },
            { name: "Contacts", rows: data.contacts as Array<Record<string, unknown>> },
            { name: "Files", rows: data.files as Array<Record<string, unknown>> },
          ],
          `meda-crm-backup-${stamp()}.xlsx`,
        );
      }
      toast("Backup downloaded", "success");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const exportLeadsCSV = async () => {
    setBusy("csv");
    try {
      const data = await apiGet<{ leads: Lead[] }>("/api/export?scope=leads");
      downloadCSV(leadsToRows(data.leads), `leads-${stamp()}.csv`);
      toast(`Exported ${data.leads.length} leads`, "success");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading || !settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  return (
    <div className="animate-fade-up max-w-4xl">
      <PageHeader title="Settings" subtitle="Your workflow, your data." />

      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Backup & export</h2>
          <p className="mt-1 text-[13px] text-muted">
            Everything you import stays yours. A full backup includes leads, notes, activities,
            follow-ups, projects, tasks, contacts and the file index.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="md" onClick={exportLeadsCSV} disabled={busy === "csv"}>
              {busy === "csv" ? "Exporting…" : "⬇ All leads (CSV)"}
            </Button>
            <Button size="md" onClick={() => exportAll("xlsx")} disabled={busy === "xlsx"}>
              {busy === "xlsx" ? "Exporting…" : "⬇ Full backup (Excel)"}
            </Button>
            <Button size="md" onClick={() => exportAll("json")} disabled={busy === "json"}>
              {busy === "json" ? "Exporting…" : "⬇ Full backup (JSON)"}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Custom fields</h2>
          <p className="mt-1 text-[13px] text-muted">
            Extra fields that appear on every lead form. Imported columns the app doesn&apos;t
            recognise are stored as custom fields automatically.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {settings.customFields.length === 0 ? (
              <span className="text-[12.5px] text-subtle">No custom fields yet.</span>
            ) : (
              settings.customFields.map((field) => (
                <span
                  key={field}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 py-1 text-[12.5px]"
                >
                  {field}
                  <button
                    onClick={() =>
                      save({ customFields: settings.customFields.filter((f) => f !== field) })
                    }
                    className="text-subtle hover:text-rose-500"
                  >
                    ✕
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
              placeholder="e.g. Owner language"
              className="max-w-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newField.trim()) {
                  void save({
                    customFields: [...new Set([...settings.customFields, newField.trim()])],
                  });
                  setNewField("");
                }
              }}
            />
            <Button
              disabled={saving}
              onClick={() => {
                if (!newField.trim()) return;
                void save({
                  customFields: [...new Set([...settings.customFields, newField.trim()])],
                });
                setNewField("");
              }}
            >
              Add field
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Tag presets</h2>
          <p className="mt-1 text-[13px] text-muted">
            One-click tags shown when editing a lead or tagging in bulk.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {settings.tagPresets.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1 text-[12.5px] text-accent"
              >
                {tag}
                <button
                  onClick={() => save({ tagPresets: settings.tagPresets.filter((t) => t !== tag) })}
                  className="opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="e.g. Ready to buy"
              className="max-w-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTag.trim()) {
                  void save({ tagPresets: [...new Set([...settings.tagPresets, newTag.trim()])] });
                  setNewTag("");
                }
              }}
            />
            <Button
              disabled={saving}
              onClick={() => {
                if (!newTag.trim()) return;
                void save({ tagPresets: [...new Set([...settings.tagPresets, newTag.trim()])] });
                setNewTag("");
              }}
            >
              Add tag
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Defaults</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Default project value (ETB)</Label>
              <Input
                defaultValue={settings.prefs?.defaultProjectValue ?? 35000}
                inputMode="numeric"
                onBlur={(e) =>
                  save({
                    prefs: {
                      ...settings.prefs,
                      defaultProjectValue: Number(e.target.value.replace(/\D/g, "")) || 0,
                    },
                  })
                }
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Input value="ETB" readOnly className="opacity-60" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Keyboard shortcuts</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
            {[
              ["⌘K / Ctrl+K", "Open search"],
              ["/", "Open search"],
              ["g then d", "Go to Dashboard"],
              ["g then l", "Go to Leads"],
              ["g then p", "Go to Pipeline"],
              ["g then f", "Go to Follow-ups"],
              ["g then c", "Go to Clients"],
              ["⌘+Enter", "Save note (lead profile)"],
            ].map(([key, action]) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">
                  {key}
                </kbd>
                <span className="text-muted">{action}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">How scoring works here</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            Meda CRM never calculates or changes a lead score or tier. Whatever is in your
            spreadsheet is imported exactly as written, and only you can change it — from the lead
            card, the table, or the lead profile. Imports never delete existing information: on a
            duplicate you choose to keep, update (fills in blanks only) or import anyway.
          </p>
        </Card>
      </div>
    </div>
  );
}
