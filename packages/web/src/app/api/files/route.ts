import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getWorkspaceBase(): string {
  return path.resolve(process.cwd(), "../../workspaces");
}

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function getMimeType(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] || "application/octet-stream";
}

export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const filesDir = path.join(getWorkspaceBase(), agentId, "files");

    if (!fs.existsSync(filesDir)) {
      return NextResponse.json([]);
    }

    const entries = fs.readdirSync(filesDir);
    const files = entries
      .filter((name) => !name.endsWith(".extracted.json"))
      .map((name) => {
        const filePath = path.join(filesDir, name);
        const stat = fs.statSync(filePath);
        const ext = path.extname(name).toLowerCase();
        const mimeType = getMimeType(ext);
        const extractionPath = filePath.replace(/(\.[^.]+)$/, ".extracted.json");
        const hasExtraction = fs.existsSync(extractionPath);

        return {
          id: name,
          name,
          size: stat.size,
          type: mimeType,
          uploadedAt: stat.mtime.toISOString(),
          hasExtraction,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json(files);
  } catch (err) {
    console.error("File list error:", err);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}
