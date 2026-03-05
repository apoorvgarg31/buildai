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

function validateAccess(request: NextRequest, agentId: string | null, actor: Awaited<ReturnType<typeof requireSignedIn>>) {
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  if (!isValidAgentId(agentId)) return NextResponse.json({ error: "Invalid agentId" }, { status: 400 });
  if (!canAccessAgent(actor, agentId)) return NextResponse.json({ error: "Forbidden", reason: "ORG_MISMATCH" }, { status: 403 });
  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const actor = await requireSignedIn();
    const { name } = await params;
    const agentId = request.nextUrl.searchParams.get("agentId");

    const denied = validateAccess(request, agentId, actor);
    if (denied) return denied;
    const checkedAgentId = agentId as string;

    if (!name) return NextResponse.json({ error: "File name is required" }, { status: 400 });

    const artifactsDir = safeJoinWithin(getWorkspaceBase(), checkedAgentId, "artifacts");
    if (!artifactsDir) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    const filePath = safeJoinWithin(artifactsDir, name);
    if (!filePath) return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return NextResponse.json({ error: "Not a file" }, { status: 400 });

    const ext = path.extname(name).toLowerCase();
    const mimeType = getMimeType(ext);
    const buffer = fs.readFileSync(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename=\"${name}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("Artifacts download error:", err);
    return NextResponse.json({ error: "Failed to download artifact" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const actor = await requireSignedIn();
    const { name } = await params;
    const agentId = request.nextUrl.searchParams.get("agentId");

    const denied = validateAccess(request, agentId, actor);
    if (denied) return denied;
    const checkedAgentId = agentId as string;

    if (!name) return NextResponse.json({ error: "File name is required" }, { status: 400 });

    const artifactsDir = safeJoinWithin(getWorkspaceBase(), checkedAgentId, "artifacts");
    if (!artifactsDir) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    const filePath = safeJoinWithin(artifactsDir, name);
    if (!filePath) return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return NextResponse.json({ error: "Not a file" }, { status: 400 });

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true, name });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("Artifacts delete error:", err);
    return NextResponse.json({ error: "Failed to delete artifact" }, { status: 500 });
  }
}
