"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiPost } from "@/lib/api";
import { autoMapColumns, cleanCell } from "@/lib/import-mapping";
import { IMPORT_FIELDS, type ImportFieldKey, type ImportRow, type Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

type Step = "upload" | "map" | "duplicates" | "done";
type Mapping = Record<string, ImportFieldKey | "custom" | "ignore">;
type Decision = "skip" | "update" | "create";

type Duplicate = {
  index: number;
  matchedBy: "maps" | "identity" | "file";
  existing: Lead | null;
  incoming: ImportRow;
};

export default function ImportPage() {
  const { toast } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, string>>>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [defaultDecision, setDefaultDecision] = useState<Decision>("skip");
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(
    null,
  );

  const parseFile = useCallback(
    async (file: File) => {
      setParsing(true);
      setFileName(file.name);
      try {
        let rows: Array<Record<string, string>> = [];
        let cols: string[] = [];

        if (/\.csv$|\.txt$/i.test(file.name)) {
          const Papa = (await import("papaparse")).default;
          const text = await file.text();
          const parsed = Papa.parse<Record<string, string>>(text, {
            header: true,
            skipEmptyLines: "greedy",
            transformHeader: (h) => h.trim(),
          });
          rows = (parsed.data ?? []).map((row) => {
            const clean: Record<string, string> = {};
            for (const [k, v] of Object.entries(row)) clean[k] = cleanCell(v);
            return clean;
          });
          cols = (parsed.meta.fields ?? []).filter(Boolean);
        } else {
          const XLSX = await import("xlsx");
          const buffer = await file.arrayBuffer();
          const wb = XLSX.read(buffer, { type: "array", cellDates: true });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
          rows = json.map((row) => {
            const clean: Record<string, string> = {};
            for (const [k, v] of Object.entries(row)) clean[k.trim()] = cleanCell(v);
            return clean;
          });
          cols = rows.length ? Object.keys(rows[0]) : [];
        }

        rows = rows.filter((row) => Object.values(row).some((v) => v !== ""));
        if (!rows.length) {
          toast("No rows found in that file", "error");
          setParsing(false);
          return;
        }
        setHeaders(cols);
        setRawRows(rows);
        setMapping(autoMapColumns(cols) as Mapping);
        setStep("map");
      } catch (error) {
        toast(`Could not read file: ${(error as Error).message}`, "error");
      } finally {
        setParsing(false);
      }
    },
    [toast],
  );

  const mappedRows: ImportRow[] = useMemo(() => {
    return rawRows.map((row) => {
      const out: ImportRow = {};
      const custom: Record<string, string> = {};
      for (const header of headers) {
        const target = mapping[header];
        const value = row[header] ?? "";
        if (!target || target === "ignore" || value === "") continue;
        if (target === "custom") custom[header] = value;
        else out[target] = value;
      }
      if (Object.keys(custom).length) out.customFields = custom;
      return out;
    });
  }, [rawRows, headers, mapping]);

  const validRows = useMemo(
    () => mappedRows.filter((r) => (r.businessName ?? "").trim() !== ""),
    [mappedRows],
  );

  const nameMapped = Object.values(mapping).includes("businessName");

  const analyze = async () => {
    if (!nameMapped) return toast("Map a column to Business Name first", "error");
    setAnalyzing(true);
    try {
      const data = await apiPost<{ duplicates: Duplicate[]; newCount: number; total: number }>(
        "/api/leads/import",
        { mode: "analyze", rows: validRows },
      );
      setDuplicates(data.duplicates);
      setDecisions(Object.fromEntries(data.duplicates.map((d) => [d.index, "skip" as Decision])));
      setStep("duplicates");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const commit = async () => {
    setImporting(true);
    try {
      const data = await apiPost<{ created: number; updated: number; skipped: number }>(
        "/api/leads/import",
        {
          mode: "commit",
          rows: validRows,
          decisions: Object.fromEntries(
            Object.entries(decisions).map(([k, v]) => [String(k), v]),
          ),
          defaultDecision,
          source: fileName,
        },
      );
      setResult(data);
      setStep("done");
      toast(`Imported ${data.created} new leads`, "success");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setDuplicates([]);
    setDecisions({});
    setResult(null);
    setFileName("");
  };

  const steps: Array<{ key: Step; label: string }> = [
    { key: "upload", label: "Upload" },
    { key: "map", label: "Map columns" },
    { key: "duplicates", label: "Duplicates" },
    { key: "done", label: "Done" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Import leads"
        subtitle="CSV or Excel. Your lead scores and tiers are imported exactly as written — never recalculated."
        actions={
          step !== "upload" ? (
            <Button size="md" variant="ghost" onClick={reset}>
              Start over
            </Button>
          ) : null
        }
      />

      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition-colors",
                i <= stepIndex ? "bg-accent text-white" : "bg-surface-muted text-subtle",
              )}
            >
              {i < stepIndex ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "hidden text-[12.5px] font-medium sm:block",
                i <= stepIndex ? "text-ink" : "text-subtle",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <div
                className={cn(
                  "h-px flex-1 transition-colors",
                  i < stepIndex ? "bg-accent/50" : "bg-line",
                )}
              />
            ) : null}
          </div>
        ))}
      </div>

      {step === "upload" ? (
        <Card className="p-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void parseFile(file);
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors",
              dragActive ? "border-accent bg-accent/5" : "border-line",
            )}
          >
            <div className="mb-4 text-4xl">📄</div>
            <h3 className="text-[17px] font-semibold">Drop your CSV or Excel file here</h3>
            <p className="mt-1.5 max-w-md text-[13px] text-muted">
              Supported: .csv, .xlsx, .xls. Everything in the file is preserved — unrecognised
              columns become custom fields.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void parseFile(file);
                e.target.value = "";
              }}
            />
            <Button
              size="md"
              variant="primary"
              className="mt-5"
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
            >
              {parsing ? "Reading file…" : "Choose file"}
            </Button>
            <a
              href="/sample-leads.csv"
              download
              className="mt-3 text-[12.5px] text-accent hover:underline"
            >
              Download a sample CSV to test with
            </a>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                icon: "🧠",
                title: "Smart column detection",
                text: "Business name, phone, rating, maps URL, socials, score and tier are matched automatically — you can override anything.",
              },
              {
                icon: "🛡",
                title: "Duplicate protection",
                text: "Matched first by Google Maps URL, then by name + phone + address. You choose keep, update or import anyway.",
              },
              {
                icon: "🔒",
                title: "Your score stays yours",
                text: "Lead score and tier are imported exactly as written. The CRM never recalculates them.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-line bg-surface-muted/40 p-4">
                <div className="text-lg">{f.icon}</div>
                <div className="mt-1.5 text-[13.5px] font-semibold">{f.title}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {step === "map" ? (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold">Column mapping</h2>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {fileName} · {rawRows.length.toLocaleString()} rows · {headers.length} columns
                </p>
              </div>
              {!nameMapped ? (
                <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-[12px] text-rose-500">
                  Map a column to Business Name
                </span>
              ) : (
                <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[12px] text-emerald-600 dark:text-emerald-300">
                  {validRows.length.toLocaleString()} rows ready
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {headers.map((header) => {
                const sample = rawRows.find((r) => r[header])?.[header] ?? "";
                return (
                  <div
                    key={header}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface-muted/40 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{header}</div>
                      <div className="truncate text-[11.5px] text-subtle">
                        {sample ? `e.g. ${sample.slice(0, 40)}` : "empty"}
                      </div>
                    </div>
                    <select
                      value={mapping[header] ?? "custom"}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [header]: e.target.value as Mapping[string],
                        }))
                      }
                      className="field h-8 w-[190px] py-0 text-[12.5px]"
                    >
                      <option value="custom">Custom field (keep as-is)</option>
                      <option value="ignore">Ignore column</option>
                      {IMPORT_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-[15px] font-semibold">Preview</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">First 8 rows after mapping</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-surface-muted/60">
                  <tr>
                    {["Business", "Niche", "City", "Phone", "Score", "Tier", "Website", "Maps"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-subtle uppercase"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {validRows.slice(0, 8).map((row, i) => (
                    <tr key={i} className="border-t border-line/70">
                      <td className="max-w-[200px] truncate px-3 py-2 font-medium">
                        {row.businessName}
                      </td>
                      <td className="px-3 py-2 text-muted">{row.category ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.city ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.phone ?? "—"}</td>
                      <td className="px-3 py-2 font-semibold">{row.leadScore ?? "—"}</td>
                      <td className="px-3 py-2">{row.tier ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.website ? "yes" : "none"}</td>
                      <td className="px-3 py-2 text-muted">{row.mapsUrl ? "yes" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button size="md" variant="ghost" onClick={reset}>
              Back
            </Button>
            <Button
              size="md"
              variant="primary"
              onClick={analyze}
              disabled={analyzing || !nameMapped}
            >
              {analyzing ? "Checking duplicates…" : "Check duplicates →"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "duplicates" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-[11.5px] text-subtle">Rows ready</div>
              <div className="mt-1 text-[22px] font-semibold">{validRows.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[11.5px] text-subtle">New businesses</div>
              <div className="mt-1 text-[22px] font-semibold text-emerald-500">
                {validRows.length - duplicates.length}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-[11.5px] text-subtle">Possible duplicates</div>
              <div className="mt-1 text-[22px] font-semibold text-amber-500">
                {duplicates.length}
              </div>
            </Card>
          </div>

          {duplicates.length ? (
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-semibold">These businesses already exist</h2>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    Matched by Google Maps URL, or by name + phone + address. Nothing is deleted —
                    updating only fills in new information.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-subtle">Apply to all:</span>
                  {(["skip", "update", "create"] as Decision[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDefaultDecision(d);
                        setDecisions(
                          Object.fromEntries(duplicates.map((dup) => [dup.index, d])) as Record<
                            number,
                            Decision
                          >,
                        );
                      }}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-[12px] capitalize",
                        defaultDecision === d
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-line text-muted hover:text-ink",
                      )}
                    >
                      {d === "create" ? "Import anyway" : d === "update" ? "Update" : "Skip"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {duplicates.map((dup) => (
                  <div
                    key={dup.index}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-muted/40 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">
                        {dup.incoming.businessName}
                      </div>
                      <div className="truncate text-[11.5px] text-subtle">
                        Row {dup.index + 1} ·{" "}
                        {dup.matchedBy === "maps"
                          ? "matched by Maps URL"
                          : dup.matchedBy === "file"
                            ? "duplicate inside this file"
                            : "matched by name + phone + address"}
                        {dup.existing ? ` · existing score ${dup.existing.leadScore ?? "—"}` : ""}
                      </div>
                    </div>
                    {dup.existing ? (
                      <Link
                        href={`/leads/${dup.existing.id}`}
                        target="_blank"
                        className="text-[12px] text-accent hover:underline"
                      >
                        View existing →
                      </Link>
                    ) : null}
                    <div className="flex items-center gap-1">
                      {(["skip", "update", "create"] as Decision[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDecisions((prev) => ({ ...prev, [dup.index]: d }))}
                          disabled={d === "update" && !dup.existing}
                          className={cn(
                            "rounded-lg border px-2 py-1 text-[11.5px] capitalize disabled:opacity-40",
                            (decisions[dup.index] ?? defaultDecision) === d
                              ? "border-accent/50 bg-accent/10 text-accent"
                              : "border-line text-muted hover:text-ink",
                          )}
                        >
                          {d === "create" ? "Import anyway" : d === "update" ? "Update" : "Keep existing"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <div className="mb-2 text-3xl">✨</div>
              <h2 className="text-[15px] font-semibold">No duplicates found</h2>
              <p className="mt-1 text-[13px] text-muted">
                All {validRows.length} businesses are new to your database.
              </p>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button size="md" variant="ghost" onClick={() => setStep("map")}>
              ← Back to mapping
            </Button>
            <Button size="md" variant="primary" onClick={commit} disabled={importing}>
              {importing ? "Importing…" : `Import ${validRows.length} rows`}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "done" && result ? (
        <Card className="p-10 text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <h2 className="text-[20px] font-semibold">Import complete</h2>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-surface-muted p-4">
              <div className="text-[22px] font-semibold text-emerald-500">{result.created}</div>
              <div className="text-[12px] text-subtle">Created</div>
            </div>
            <div className="rounded-xl bg-surface-muted p-4">
              <div className="text-[22px] font-semibold text-sky-500">{result.updated}</div>
              <div className="text-[12px] text-subtle">Updated</div>
            </div>
            <div className="rounded-xl bg-surface-muted p-4">
              <div className="text-[22px] font-semibold text-muted">{result.skipped}</div>
              <div className="text-[12px] text-subtle">Skipped</div>
            </div>
          </div>
          <div className="mt-7 flex justify-center gap-2">
            <Button size="md" onClick={reset}>
              Import another file
            </Button>
            <Button size="md" variant="primary" onClick={() => router.push("/leads")}>
              Go to leads →
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
