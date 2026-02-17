"use client";

import { useCallback, useState } from "react";

export interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  url?: string;
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
  documents: UploadedDoc[];
  onRemove: (id: string) => void;
  onAdd: (files: FileList) => void;
  onClose: () => void;
}

export default function DocumentPanel({ documents, onRemove, onAdd, onClose }: DocumentPanelProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useCallback((el: HTMLInputElement | null) => {
    if (el) el.value = "";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) onAdd(e.dataTransfer.files);
    },
    [onAdd]
  );

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#e5e5e5]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5]">
        <div>
          <h3 className="text-sm font-semibold text-[#171717]">Documents</h3>
          <p className="text-[11px] text-[#8e8e8e] mt-0.5">{documents.length} file{documents.length !== 1 ? "s" : ""}</p>
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
          onChange={(e) => { if (e.target.files?.length) onAdd(e.target.files); }}
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
                className="group flex items-start gap-3 p-3 rounded-xl bg-[#f9f9f9] border border-[#e5e5e5] hover:border-[#d9d9d9] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-[#e5e5e5] flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{getFileIcon(doc.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#171717] truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[#e5e5e5] text-[#666]">
                      {doc.type.split("/").pop()?.toUpperCase() || "FILE"}
                    </span>
                    <span className="text-xs text-[#b4b4b4]">
                      {formatFileSize(doc.size)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(doc.id)}
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
