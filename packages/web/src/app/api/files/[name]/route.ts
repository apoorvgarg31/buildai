import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getWorkspaceBase(): string {
  return path.resolve(process.cwd(), "../../workspaces");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const agentId = request.nextUrl.searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "File name is required" }, { status: 400 });
    }

    const filesDir = path.join(getWorkspaceBase(), agentId, "files");
    const filePath = path.join(filesDir, name);

    // Security: ensure the resolved path is within the files directory
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(filesDir);
    if (!resolvedPath.startsWith(resolvedDir)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete the file
    fs.unlinkSync(filePath);

    // Also delete extraction file if it exists
    const ext = path.extname(name);
    const baseName = path.basename(name, ext);
    const extractionPath = path.join(filesDir, `${baseName}.extracted.json`);
    if (fs.existsSync(extractionPath)) {
      fs.unlinkSync(extractionPath);
    }

    return NextResponse.json({ success: true, name });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
