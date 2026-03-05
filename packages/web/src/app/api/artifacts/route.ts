import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { canAccessAgent, requireSignedIn } from "@/lib/api-guard";
import { isValidAgentId, safeJoinWithin } from "@/lib/security";

function getWorkspaceBase(): string {
  return path.resolve(process.cwd(), "../../workspaces");
}

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".zip": "application/zip",
};

function getMimeType(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] || "application/octet-stream";
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const agentId = request.nextUrl.searchParams.get("agentId");

    if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    if (!isValidAgentId(agentId)) return NextResponse.json({ error: "Invalid agentId" }, { status: 400 });
    if (!canAccessAgent(actor, agentId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const artifactsDir = safeJoinWithin(getWorkspaceBase(), agentId, "artifacts");
    if (!artifactsDir) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    if (!fs.existsSync(artifactsDir)) return NextResponse.json([]);

    const entries = fs.readdirSync(artifactsDir);
    const files = entries
      .map((name) => {
        const filePath = path.join(artifactsDir, name);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return null;
        const ext = path.extname(name).toLowerCase();
        return {
          id: name,
          name,
          size: stat.size,
          type: getMimeType(ext),
          createdAt: stat.mtime.toISOString(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date((b as { createdAt: string }).createdAt).getTime() - new Date((a as { createdAt: string }).createdAt).getTime());

    return NextResponse.json(files);
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("Artifacts list error:", err);
    return NextResponse.json({ error: "Failed to list artifacts" }, { status: 500 });
  }
}
