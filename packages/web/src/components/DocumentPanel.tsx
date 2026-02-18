"use client";

import { useCallback, useState, useEffect } from "react";

export interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  hasExtraction?: boolean;
  status?: "uploading" | "done" | "error";
  progress?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string): string {
  if (type.includes("pdf")) return "📄";
  if (type.includes("word") || type.includes("doc")) return "📝";
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return "📊";
  if (type.includes("image") || type.includes("png") || type.includes("jpg")) return "🖼️";
  if (type.includes("presentation") || type.includes("pptx")) return "📎";
  return "📎";
}

interface DocumentPanelProps {
  agentId: string;
  documents: UploadedDoc[];
  setDocuments: React.Dispatch<React.SetStateAction<UploadedDoc[]>>;
  onClose: () => void;
}

export default function DocumentPanel({ agentId, documents, setDocuments, onClose }: DocumentPanelProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fileInputRef = useCallback((el: HTMLInputElement | null) => {
    if (el) el.value = "";
  }, []);

  // Load existing files from server on mount
  useEffect(() => {
    if (loaded || !agentId) return;
    setLoaded(true);

    fetch(`/api/files?agentId=${encodeURIComponent(agentId)}`)
      .then((res) => res.json())
      .then((files: Array<{ id: string; name: string; size: number; type: string; uploadedAt: string; hasExtraction: boolean }>) => {
        if (Array.isArray(files)) {
          const serverDocs: UploadedDoc[] = files.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.type,
            uploadedAt: new Date(f.uploadedAt),
            hasExtraction: f.hasExtraction,
            status: "done" as const,
          }));
          setDocuments((prev) => {
            // Merge: keep pending uploads, add server files that aren't duplicates
            const pendingNames = new Set(prev.filter((d) => d.status === "uploading").map((d) => d.name));
            const merged = [...prev.filter((d) => d.status === "uploading")];
            for (const doc of serverDocs) {
              if (!pendingNames.has(doc.name)) {
                merged.push(doc);
              }
            }
            return merged;
          });
        }
      })
      .catch((err) => console.error("Failed to load files:", err));
  }, [agentId, loaded, setDocuments]);

  const uploadFile = useCallback(
    async (file: File) => {
      const tempId = crypto.randomUUID();
      const newDoc: UploadedDoc = {
        id: tempId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date(),
        status: "uploading",
      };

      setDocuments((prev) => [...prev, newDoc]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("agentId", agentId);

        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error || "Upload failed");
        }

        const result = await res.json();

        setDocuments((prev) =>
          prev.map((d) =>
            d.id === tempId
              ? {
                  ...d,
                  id: result.id,
                  name: result.name,
                  size: result.size,
                  type: result.type,
                  hasExtraction: result.extractedText,
                  status: "done" as const,
                }
              : d
          )
        );
      } catch (err) {
        console.error("Upload error:", err);
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === tempId ? { ...d, status: "error" as const } : d
          )
        );
      }
    },
    [agentId, setDocuments]
  );

  const handleAddFiles = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((file) => uploadFile(file));
    },
    [uploadFile]
  );

  const handleDelete = useCallback(
    async (doc: UploadedDoc) => {
      if (doc.status === "uploading" || doc.status === "error") {
        // Just remove from local state
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        return;
      }

      try {
        const res = await fetch(
          `/api/files/${encodeURIComponent(doc.name)}?agentId=${encodeURIComponent(agentId)}`,
          { method: "DELETE" }
        );

        if (res.ok) {
          setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        }
      } catch (err) {
        console.error("Delete error:", err);
      }
    },
    [agentId, setDocuments]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) handleAddFiles(e.dataTransfer.files);
    },
    [handleAddFiles]
  );

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#e5e5e5]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5]">
        <div>
          <h3 className="text-sm font-semibold text-[#171717]">Documents</h3>
          <p className="text-[11px] text-[#8e8e8e] mt-0.5">
            {documents.filter((d) => d.status === "done").length} file{documents.filter((d) => d.status === "done").length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[#8e8e8e] hover:text-[#171717] transition-colors rounded-lg hover:bg-[#f4f4f4]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("doc-file-input")?.click()}
          className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            dragOver
              ? "border-[#171717] bg-[#f4f4f4]"
              : "border-[#e5e5e5] hover:border-[#b4b4b4] hover:bg-[#f9f9f9]"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 mb-1.5 ${dragOver ? "text-[#171717]" : "text-[#b4b4b4]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-xs font-medium text-[#666]">
            Drop files here or click to upload
          </span>
          <span className="text-xs text-[#b4b4b4] mt-0.5">
            PDF, Word, Excel, Images
          </span>
        </div>

        <input
          id="doc-file-input"
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp"
          onChange={(e) => { if (e.target.files?.length) handleAddFiles(e.target.files); }}
        />

        {/* File list */}
        {documents.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-[#8e8e8e]">
              No documents yet
            </p>
            <p className="text-xs text-[#b4b4b4] mt-1">
              Upload project documents for context
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`group flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                  doc.status === "error"
                    ? "bg-red-50 border-red-200"
                    : doc.status === "uploading"
                    ? "bg-[#f9f9f9] border-[#e5e5e5] opacity-70"
                    : "bg-[#f9f9f9] border-[#e5e5e5] hover:border-[#d9d9d9]"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-[#e5e5e5] flex items-center justify-center flex-shrink-0">
                  {doc.status === "uploading" ? (
                    <svg className="w-5 h-5 text-[#b4b4b4] animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <span className="text-lg">{getFileIcon(doc.type)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#171717] truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[#e5e5e5] text-[#666]">
                      {doc.name.split(".").pop()?.toUpperCase() || "FILE"}
                    </span>
                    <span className="text-xs text-[#b4b4b4]">
                      {formatFileSize(doc.size)}
                    </span>
                    {doc.status === "uploading" && (
                      <span className="text-xs text-[#8e8e8e] italic">Uploading...</span>
                    )}
                    {doc.status === "error" && (
                      <span className="text-xs text-red-500">Failed</span>
                    )}
                    {doc.hasExtraction && (
                      <span className="text-xs text-emerald-600">✓ Extracted</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc)}
                  className="p-1.5 text-[#b4b4b4] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
                  title="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
