import { requireAuth } from "@/lib/server/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projectFiles } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const fileId = Number(id);
  if (!Number.isFinite(fileId)) return new Response("Invalid id", { status: 400 });

  const [file] = await db.select().from(projectFiles).where(eq(projectFiles.id, fileId));
  if (!file) return new Response("Not found", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "true";
  const bytes = Buffer.from(file.data, "base64");
  const body = new Uint8Array(bytes);

  return new Response(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(
        file.name,
      )}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
