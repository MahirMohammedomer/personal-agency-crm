import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";

/** Recalculate progress from completed tasks — only when the project is in auto mode. */
export async function syncProjectProgress(projectId: number) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project || !project.autoProgress) return project ?? null;

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) FILTER (WHERE ${tasks.status} = 'done')::int`,
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  if (!counts || counts.total === 0) return project;

  const progress = Math.round((counts.done / counts.total) * 100);
  if (progress === project.progress) return project;

  const [updated] = await db
    .update(projects)
    .set({ progress, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  return updated;
}

export function clampProgress(value: unknown): number {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function toInt(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : fallback;
}
