"use client";

import { useState, useRef, useCallback } from "react";

export interface AttachedFile { id: string; name: string; size: number; status: "uploading" | "done" | "error"; }
interface ChatInputProps { onSend: (message: string) => void; onFilesAttached: (files: FileList) => void; disabled?: boolean; }

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatInput({ onSend, onFilesAttached, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    setAttachedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } };
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => { setInput(e.target.value); const t = e.target; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 200) + "px"; };
  const handleFileClick = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newChips: AttachedFile[] = Array.from(e.target.files).map((f) => ({ id: crypto.randomUUID(), name: f.name, size: f.size, status: "uploading" }));
      setAttachedFiles((prev) => [...prev, ...newChips]);
      onFilesAttached(e.target.files);
      setTimeout(() => setAttachedFiles((prev) => prev.map((f) => newChips.some((n) => n.id === f.id) ? { ...f, status: "done" } : f)), 1500);
      e.target.value = "";
    }
  }, [onFilesAttached]);
  const removeAttached = useCallback((id: string) => setAttachedFiles((prev) => prev.filter((f) => f.id !== id)), []);

  return (
    <div className="border-t border-slate-200/50 bg-[rgba(255,255,255,0.62)] px-4 pb-5 pt-3 backdrop-blur-xl">
      <div className="mx-auto max-w-[760px]">
        {attachedFiles.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{attachedFiles.map((file) => <div key={file.id} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${file.status === "uploading" ? "border-slate-200 bg-white/80 text-slate-500" : file.status === "error" ? "border-red-200 bg-red-50 text-red-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}><span>{file.status === "uploading" ? "◌" : file.status === "done" ? "✓" : "✕"}</span><span className="max-w-[140px] truncate">{file.name}</span><span className="text-slate-400">{formatFileSize(file.size)}</span><button onClick={() => removeAttached(file.id)} className="text-slate-400 hover:text-slate-700">×</button></div>)}</div>}
        <div className="mira-surface flex items-end gap-2 rounded-[1.8rem] px-3 py-2">
          <button onClick={handleFileClick} className="rounded-2xl p-3 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" title="Attach documents">+
          </button>
          <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp" onChange={handleFileChange} />
          <textarea ref={textareaRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown} placeholder="Ask Mira anything about your project" rows={1} disabled={disabled} className="flex-1 resize-none bg-transparent px-1 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 max-h-[200px]" />
          <button onClick={handleSubmit} disabled={!input.trim() || disabled} className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-all ${input.trim() && !disabled ? "bg-[linear-gradient(145deg,#0f2746,#3b82f6)] shadow-[0_16px_32px_rgba(59,130,246,0.24)]" : "bg-slate-300 cursor-not-allowed"}`} title="Send message">↗</button>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">Mira can make mistakes. Verify critical project data before action.</p>
      </div>
    </div>
  );
}
