import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId, safeJoinWithin } from '@/lib/security';

function getWorkspaceBase(): string {
  return path.resolve(process.cwd(), "../../workspaces");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const actor = await requireSignedIn();
    const { name } = await params;
    const agentId = request.nextUrl.searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }
    if (!isValidAgentId(agentId)) {
      return NextResponse.json({ error: "Invalid agentId" }, { status: 400 });
    }
    if (!canAccessAgent(actor, agentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!name) {
      return NextResponse.json({ error: "File name is required" }, { status: 400 });
    }

    const filesDir = safeJoinWithin(getWorkspaceBase(), agentId, "files");
    if (!filesDir) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
    const filePath = safeJoinWithin(filesDir, name);
    if (!filePath) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    fs.unlinkSync(filePath);

    const ext = path.extname(name);
    const baseName = path.basename(name, ext);
    const extractionPath = path.join(filesDir, `${baseName}.extracted.json`);
    if (fs.existsSync(extractionPath)) {
      fs.unlinkSync(extractionPath);
    }

    return NextResponse.json({ success: true, name });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error("Delete error:", err);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
