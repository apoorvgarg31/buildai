import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".docx", ".xlsx", ".csv", ".txt",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
]);

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

function getWorkspaceBase(): string {
  return path.resolve(process.cwd(), "../../workspaces");
}

function getUniqueFilename(dir: string, originalName: string): string {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  let candidate = originalName;
  let counter = 2;

  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${counter}${ext}`;
    counter++;
  }

  return candidate;
}

function runExtraction(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const engineDir = path.resolve(process.cwd(), "../../packages/engine");
    const cmd = `bash skills/buildai-pdf-extract/extract.sh "${filePath}" text`;
    exec(cmd, { cwd: engineDir, timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const agentId = formData.get("agentId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!agentId) {
      return NextResponse.json({ error: "No agentId provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 20MB.` },
        { status: 400 }
      );
    }

    // Validate file type
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type not allowed. Supported: PDF, DOCX, XLSX, CSV, TXT, PNG, JPG, JPEG, GIF, WEBP` },
        { status: 400 }
      );
    }

    // Ensure directory exists
    const filesDir = path.join(getWorkspaceBase(), agentId, "files");
    fs.mkdirSync(filesDir, { recursive: true });

    // Get unique filename
    const uniqueName = getUniqueFilename(filesDir, file.name);
    const filePath = path.join(filesDir, uniqueName);

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Auto-extract text for PDFs
    let extractedText = false;
    if (ext === ".pdf") {
      try {
        const extractionResult = await runExtraction(filePath);
        const extractionPath = filePath.replace(/\.pdf$/i, ".extracted.json");
        fs.writeFileSync(extractionPath, extractionResult);
        extractedText = true;
      } catch (err) {
        // Extraction failed — non-fatal, file is still uploaded
        console.error("PDF extraction failed:", err);
      }
    }

    return NextResponse.json({
      id: uniqueName,
      name: uniqueName,
      path: `files/${uniqueName}`,
      size: file.size,
      type: file.type,
      extractedText,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
