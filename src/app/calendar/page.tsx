"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiGet } from "@/lib/api";
import { addDaysISO, cn, formatDate, toISODate, todayISO } from "@/lib/utils";

type CalendarEvent = {
  id: string;
  date: string;
  type: "followup" | "task" | "project" | "meeting";
  title: string;
  subtitle: string;
  href: string;
  done: boolean;
  meta?: string;
};

const TYPE_STYLE: Record<CalendarEvent["type"], { dot: string; chip: string; icon: string; label: string }> = {
  followup: {
    dot: "bg-amber-500",
    chip: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
    icon: "◷",
    label: "Follow-up",
  },
  task: {
    dot: "bg-indigo-500",
    chip: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300",
    icon: "✓",
    label: "Task",
  },
  project: {
    dot: "bg-rose-500",
    chip: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
    icon: "◈",
    label: "Deadline",
  },
  meeting: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    icon: "🤝",
    label: "Meeting",
  },
};

export default function CalendarPage() {
  const { toast } = useToast();
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string>(todayISO());

  const range = useMemo(() => {
    const d = new Date(cursor);
    if (view === "day") return { from: toISODate(d), to: toISODate(d) };
    if (view === "week") {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: toISODate(start), to: toISODate(end) };
    }
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    const gridEnd = new Date(last);
    gridEnd.setDate(last.getDate() + (6 - last.getDay()));
    return { from: toISODate(gridStart), to: toISODate(gridEnd) };
  }, [cursor, view]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ events: CalendarEvent[] }>(
        `/api/calendar?from=${range.from}&to=${range.to}`,
      );
      setEvents(data.events);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => events.filter((e) => !hidden.has(e.type)),
    [events, hidden],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of visible) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [visible]);

  const days = useMemo(() => {
    const out: string[] = [];
    let d = range.from;
    let guard = 0;
    while (d <= range.to && guard < 60) {
      out.push(d);
      d = addDaysISO(1, new Date(`${d}T00:00:00`));
      guard += 1;
    }
    return out;
  }, [range]);

  const shift = (dir: number) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  };

  const label =
    view === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week"
        ? `${formatDate(`${range.from}T00:00:00`)} – ${formatDate(`${range.to}T00:00:00`)}`
        : formatDate(`${range.from}T00:00:00`);

  const today = todayISO();
  const dayEvents = byDate.get(selected) ?? [];

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Calendar"
        subtitle="Follow-ups, task due dates, project deadlines and meetings in one view."
        actions={
          <div className="flex items-center rounded-xl border border-line p-0.5">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-[10px] px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors",
                  view === v ? "bg-surface-muted text-ink" : "text-subtle hover:text-ink",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <Button size="sm" onClick={() => shift(-1)}>
          ←
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setCursor(new Date());
            setSelected(today);
          }}
        >
          Today
        </Button>
        <Button size="sm" onClick={() => shift(1)}>
          →
        </Button>
        <span className="ml-2 text-[15px] font-semibold">{label}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(Object.keys(TYPE_STYLE) as CalendarEvent["type"][]).map((type) => {
            const off = hidden.has(type);
            const count = events.filter((e) => e.type === type).length;
            return (
              <button
                key={type}
                onClick={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(type)) next.delete(type);
                    else next.add(type);
                    return next;
                  })
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] transition-opacity",
                  off ? "border-line opacity-40" : "border-line",
                )}
                title={off ? "Show" : "Hide"}
              >
                <span className={cn("h-2 w-2 rounded-full", TYPE_STYLE[type].dot)} />
                {TYPE_STYLE[type].label}
                <span className="text-subtle">{count}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {loading ? (
        <Skeleton className="h-[520px]" />
      ) : view === "day" ? (
        <DayList date={range.from} events={byDate.get(range.from) ?? []} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line bg-surface-muted/50">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-subtle uppercase"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className={cn("grid grid-cols-7", view === "week" && "min-h-[320px]")}>
              {days.map((date) => {
                const items = byDate.get(date) ?? [];
                const inMonth =
                  view === "week" || new Date(`${date}T00:00:00`).getMonth() === cursor.getMonth();
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    onClick={() => setSelected(date)}
                    className={cn(
                      "min-h-[104px] border-r border-b border-line p-1.5 text-left transition-colors last:border-r-0 hover:bg-surface-muted/60",
                      !inMonth && "bg-surface-muted/25",
                      selected === date && "bg-accent/5 ring-1 ring-accent/30 ring-inset",
                    )}
                  >
                    <div className="mb-1 flex items-center gap-1">
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[11.5px] font-medium",
                          isToday
                            ? "bg-accent text-white"
                            : inMonth
                              ? "text-ink"
                              : "text-subtle",
                        )}
                      >
                        {Number(date.slice(8, 10))}
                      </span>
                      {items.length > 2 ? (
                        <span className="ml-auto text-[10px] text-subtle">{items.length}</span>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className={cn(
                            "truncate rounded-md px-1.5 py-0.5 text-[10.5px] leading-tight",
                            TYPE_STYLE[e.type].chip,
                            e.done && "opacity-45 line-through",
                          )}
                          title={`${e.title} — ${e.subtitle}`}
                        >
                          {TYPE_STYLE[e.type].icon} {e.title}
                        </div>
                      ))}
                      {items.length > 3 ? (
                        <div className="px-1 text-[10px] text-subtle">+{items.length - 3} more</div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <div>
            <DayList date={selected} events={dayEvents} compact />
          </div>
        </div>
      )}
    </div>
  );
}

function DayList({
  date,
  events,
  compact,
}: {
  date: string;
  events: CalendarEvent[];
  compact?: boolean;
}) {
  return (
    <Card className={cn("p-5", compact && "sticky top-4")}>
      <h2 className="text-[15px] font-semibold">
        {date === todayISO() ? "Today" : formatDate(`${date}T00:00:00`)}
      </h2>
      <p className="mt-0.5 text-[12px] text-subtle">
        {events.length} item{events.length === 1 ? "" : "s"}
      </p>
      <div className="mt-4 space-y-2">
        {events.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-subtle">Nothing scheduled.</p>
        ) : (
          events.map((e) => (
            <Link
              key={e.id}
              href={e.href}
              className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-muted/40 p-3 transition-colors hover:bg-surface-muted"
            >
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", TYPE_STYLE[e.type].dot)} />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[13.5px] font-medium",
                    e.done && "text-subtle line-through",
                  )}
                >
                  {e.title}
                </span>
                <span className="block truncate text-[11.5px] text-subtle">
                  {TYPE_STYLE[e.type].label} · {e.subtitle}
                </span>
              </span>
              {e.meta ? (
                <span className="shrink-0 text-[11px] text-subtle capitalize">{e.meta}</span>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
