"use client";

import { useEffect, useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { Button, Dialog, Field, Input, Switch } from "@/components/ui/ui";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPatch } from "@/lib/api";
import { copyText } from "@/lib/utils";
import {
  DEFAULT_WEBSITE_BRIEF_TEMPLATE,
  WEBSITE_BRIEF_SETTING_KEY,
  fillWebsiteBrief,
  missingBriefFields,
} from "@/lib/website-brief";
import type { Lead } from "@/lib/types";

/**
 * Copies the AI website brief for a lead (Settings → Website brief template),
 * remembers the prototype URL and can move the lead to “Proposal”.
 */
export function WebsiteBriefDialog({
  open,
  onClose,
  lead,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSaved?: (lead: Lead, patch: Partial<Lead>) => void;
}) {
  const { toast } = useToast();
  const [markProposal, setMarkProposal] = useState(true);
  const [prototypeUrl, setPrototypeUrl] = useState("");
  const [template, setTemplate] = useState(DEFAULT_WEBSITE_BRIEF_TEMPLATE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !lead) return;
    setPrototypeUrl(lead.customFields?.prototype_url ?? "");
    setMarkProposal(lead.status !== "Won" && lead.status !== "Lost" && lead.status !== "Not Interested");
    setBusy(false);
    apiGet<{ settings: Record<string, unknown> }>("/api/settings")
      .then((data) => {
        const stored = data.settings?.[WEBSITE_BRIEF_SETTING_KEY];
        if (typeof stored === "string" && stored.trim()) setTemplate(stored);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.id]);

  if (!lead) return null;

  const missing = missingBriefFields(lead);

  const copyBrief = async () => {
    setBusy(true);
    try {
      const text = fillWebsiteBrief(template, lead);
      const ok = await copyText(text);
      if (!ok) throw new Error("Could not access the clipboard");

      const customFields = { ...(lead.customFields ?? {}) };
      customFields.last_brief_copied_at = new Date().toISOString();
      if (prototypeUrl.trim()) customFields.prototype_url = prototypeUrl.trim();

      const patch: Partial<Lead> = { customFields };
      if (markProposal) patch.status = "Proposal";

      const result = await apiPatch<{ lead: Lead }>(`/api/leads/${lead.id}`, patch);
      onSaved?.(lead, result?.lead ?? patch);
      toast("Website brief copied", "success");
      onClose();
    } catch (error) {
      toast((error as Error).message || "Could not copy the brief", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Copy website brief"
      description="Fills your template (Settings → Website brief) with this lead's details."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void copyBrief()} disabled={busy}>
            <ClipboardCopy className="h-4 w-4" /> {busy ? "Copying…" : "Copy brief"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink">Move to “Proposal”</div>
            <div className="text-[11.5px] text-muted">Marks this lead as a sent proposal.</div>
          </div>
          <Switch checked={markProposal} onChange={setMarkProposal} />
        </label>

        <Field label="Prototype link (optional)" hint="Saved on the lead so you can find it later.">
          <Input
            value={prototypeUrl}
            onChange={(e) => setPrototypeUrl(e.target.value)}
            placeholder="https://prototype.vercel.app"
            inputMode="url"
            autoComplete="off"
          />
        </Field>

        {missing.length > 0 && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
            Missing on this lead: {missing.join(", ")} — the brief will show a dash for those.
          </p>
        )}
      </div>
    </Dialog>
  );
}
