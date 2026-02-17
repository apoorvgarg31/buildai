"use client";

import { useState, useCallback } from "react";

export interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  url?: string; // object URL for preview
}

interface DocumentPanelProps {
  documents: UploadedDoc[];
  onRemove: (id: string) => void;
  onAdd: (files: FileList) => void;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string): string {
  if (type.includes("pdf")) return "📕";
  if (type.includes("word") || type.includes("docx") || type.includes("doc"))
    return "📘";
  if (type.includes("sheet") || type.includes("excel") || type.includes("xlsx"))
    return "📗";
  if (type.includes("presentation") || type.includes("pptx"))
    return "📙";
  if (type.includes("image")) return "🖼️";
  if (type.includes("text") || type.includes("csv")) return "📄";
  return "📎";
}

function getFileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toUpperCase() : "FILE";
}

export default function DocumentPanel({
  documents,
  onRemove,
  onAdd,
  onClose,
}: DocumentPanelProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        onAdd(e.dataTransfer.files);
      }
    },
    [onAdd]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onAdd(e.target.files);
        e.target.value = ""; // reset so same file can be added again
      }
    },
    [onAdd]
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">📎</span>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Documents
          </h3>
          {documents.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full">
              {documents.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Close panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Upload area */}
      <div className="px-4 py-3">
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            dragOver
              ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-amber-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 mb-1.5 ${dragOver ? "text-amber-500" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {dragOver ? "Drop files here" : "Drop files or click to upload"}
          </span>
          <span className="text-xs text-gray-400 mt-0.5">
            PDF, Word, Excel, Images
          </span>
          <input
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp"
            onChange={handleFileInput}
          />
        </label>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-3xl mb-2">📂</span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No documents yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Upload files or attach them in chat
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 hover:border-amber-200 dark:hover:border-amber-800/50 transition-colors"
              >
                {/* File icon */}
                <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{getFileIcon(doc.type)}</span>
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={doc.name}>
                    {doc.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                      {getFileExtension(doc.name)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatFileSize(doc.size)}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => onRemove(doc.id)}
                  className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Remove document"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
