"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ChatMessage, { Message } from "./ChatMessage";
import ChatInput from "./ChatInput";
import DocumentPanel, { UploadedDoc } from "./DocumentPanel";

function sanitizeContent(text: string): string {
  return text.replace(/\[\[\s*reply_to[:\s][^\]]*\]\]/gi, "").replace(/\[\[\s*reply_to_current\s*\]\]/gi, "").replace(/\bNO_REPLY\b/g, "").replace(/\bHEARTBEAT_OK\b/g, "").trim();
}

async function sendChatMessageStream(message: string, sessionId: string | null, onDelta: (text: string) => void, onThinking?: (text: string) => void, onTool?: (name: string) => void, onArtifacts?: (artifacts: Array<{ name: string; size: number; createdAt: string }>) => void): Promise<{ sessionId: string }> {
  const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, sessionId, stream: true }) });
  if (!res.ok) { const error = await res.json().catch(() => ({ error: "Request failed" })); throw new Error(error.error || `HTTP ${res.status}`); }
  const reader = res.body?.getReader(); if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder(); let buffer = ""; let returnedSessionId = sessionId || "";
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = JSON.parse(line.slice(6));
      if (data.type === "delta" && data.text) onDelta(data.text);
      else if (data.type === "thinking" && data.text && onThinking) onThinking(data.text);
      else if (data.type === "tool" && data.name && onTool) onTool(data.name);
      else if (data.type === "artifacts" && Array.isArray(data.artifacts) && onArtifacts) onArtifacts(data.artifacts);
      else if (data.type === "done") returnedSessionId = data.sessionId || returnedSessionId;
      else if (data.type === "error") throw new Error(data.message || "Stream error");
    }
  }
  return { sessionId: returnedSessionId };
}

interface ChatAreaProps { agentId?: string; }

export default function ChatArea({ agentId }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingPreview, setThinkingPreview] = useState("");
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(agentId ? `agent:${agentId}:webchat:default` : null);
  const [engineStatus, setEngineStatus] = useState<"mock" | "connected" | "checking">("checking");
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [artifacts, setArtifacts] = useState<Array<{ name: string; size: number; createdAt: string }>>([]);
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(120);
  const [compactionHint, setCompactionHint] = useState("");
  const [knownFileNames, setKnownFileNames] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useCallback(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { fetch("/api/chat").then((res) => res.json()).then((data) => setEngineStatus(data.status === "ok" ? "connected" : "mock")).catch(() => setEngineStatus("mock")); }, []);
  useEffect(() => { if (agentId) { const expected = `agent:${agentId}:webchat:default`; if (sessionId !== expected && messages.length === 0) { setSessionId(expected); setHasOnboarded(false); } } }, [agentId, sessionId, messages.length]);
  useEffect(() => { if (agentId) fetch(`/api/artifacts?agentId=${encodeURIComponent(agentId)}`).then((res) => (res.ok ? res.json() : [])).then((data) => { if (Array.isArray(data)) setArtifacts(data); }).catch(() => undefined); }, [agentId]);
  useEffect(() => {
    if (hasOnboarded) return; setHasOnboarded(true);
    if (!sessionId) { setMessages([]); return; }
    fetch(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`).then((res) => res.json()).then((data) => {
      if (data.messages?.length > 0) {
        setMessages(data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; timestamp: string }) => ({ id: m.id, role: m.role, content: m.role === "assistant" ? sanitizeContent(m.content) : m.content, timestamp: new Date(m.timestamp) })));
        if (data.messages.length >= 95) setCompactionHint("Older context may be compacted by the engine to keep chat fast.");
      } else setMessages([]);
    }).catch(() => setMessages([]));
  }, [hasOnboarded, sessionId]);

  const uploadFile = useCallback(async (file: File) => {
    if (!agentId) return;
    const tempId = crypto.randomUUID();
    setDocuments((prev) => [...prev, { id: tempId, name: file.name, size: file.size, type: file.type, uploadedAt: new Date(), status: "uploading" }]);
    setShowDocPanel(true);
    try {
      const formData = new FormData(); formData.append("file", file); formData.append("agentId", agentId);
      const res = await fetch("/api/files/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      setDocuments((prev) => prev.map((d) => d.id === tempId ? { ...d, id: result.id, name: result.name, size: result.size, type: result.type, hasExtraction: result.extractedText, status: "done" } : d));
    } catch {
      setDocuments((prev) => prev.map((d) => d.id === tempId ? { ...d, status: "error" } : d));
    }
  }, [agentId]);

  const addDocuments = useCallback((files: FileList) => Array.from(files).forEach((file) => uploadFile(file)), [uploadFile]);

  const handleSend = useCallback(async (content: string) => {
    const completedDocs = documents.filter((d) => d.status === "done");
    const newFiles = completedDocs.filter((d) => !knownFileNames.has(d.name));
    let messageToSend = content;
    if (newFiles.length > 0) {
      const fileList = newFiles.map((f) => `${f.name} (at files/${f.name})`).join(", ");
      messageToSend = `[Context: The user has uploaded the following files to their workspace: ${fileList}. You can use the PDF extract skill to read PDFs, or read other files directly.]\n\n${content}`;
    }
    setKnownFileNames(new Set(completedDocs.map((d) => d.name)));
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]); setIsLoading(true); setThinkingPreview(""); setActiveTools([]);
    const assistantId = crypto.randomUUID(); let receivedFirstDelta = false;
    try {
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date(), isThinking: true }]);
      const result = await sendChatMessageStream(messageToSend, sessionId, (delta) => { if (!receivedFirstDelta) { receivedFirstDelta = true; setIsStreaming(true); } setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: sanitizeContent(delta), isThinking: false } : m)); }, (thinkingText) => setThinkingPreview(thinkingText.slice(0, 240)), (toolName) => setActiveTools((prev) => prev.includes(toolName) ? prev : [...prev, toolName]), (newArtifacts) => setArtifacts((prev) => { const existing = new Set(prev.map((a) => a.name)); const merged = [...prev]; for (const a of newArtifacts) if (!existing.has(a.name)) merged.unshift(a); return merged; }));
      if (result.sessionId) setSessionId(result.sessionId);
    } catch (err) {
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `Warning: ${err instanceof Error ? err.message : "Failed to get response"}. Please try again.`, isThinking: false } : m));
    } finally { setIsLoading(false); setIsStreaming(false); setThinkingPreview(""); setActiveTools([]); }
  }, [sessionId, documents, knownFileNames]);

  const visibleMessages = useMemo(() => messages.length <= visibleCount ? messages : messages.slice(messages.length - visibleCount), [messages, visibleCount]);
  const hiddenCount = Math.max(0, messages.length - visibleMessages.length);

  if (!agentId) {
    return <div className="mira-app-shell flex h-full items-center justify-center px-6"><div className="mira-surface max-w-md rounded-[2rem] px-8 py-10 text-center"><div className="mira-icon-chip mx-auto text-2xl">◌</div><h2 className="mt-5 text-xl font-semibold text-slate-950">No agent assigned</h2><p className="mt-2 text-sm leading-6 text-slate-600">An admin needs to create an agent and assign it to your account before you can start chatting.</p></div></div>;
  }

  return (
    <div className="mira-app-shell flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mira-page-header py-4">
          <div>
            <p className="mira-eyebrow">Live conversation</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">Mira chat</h2>
            <p className="mt-2 text-sm text-slate-600">Premium project assistance with artifact generation, documents, and contextual memory.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`mira-pill ${engineStatus === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{engineStatus === "connected" ? "Connected" : engineStatus === "checking" ? "Checking" : "Preview"}</span>
            <button onClick={() => setShowDocPanel(!showDocPanel)} className="mira-button-secondary px-4 py-2 text-xs font-semibold">Docs {documents.filter((d) => d.status === "done").length > 0 ? `(${documents.filter((d) => d.status === "done").length})` : ""}</button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-5 sm:px-4">
          {messages.length === 0 && !isLoading && <div className="flex min-h-[420px] items-center justify-center"><div className="mira-surface text-center rounded-[2rem] px-10 py-12"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f2746,#3b82f6)] text-sm font-semibold tracking-[0.28em] text-white">M</div><h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-slate-950">What can I help with?</h2><p className="mt-2 text-sm text-slate-500">Your AI construction PM assistant in the Mira system.</p></div></div>}
          {hiddenCount > 0 && <div className="mx-auto mb-2 max-w-[760px] px-4"><button onClick={() => setVisibleCount((v) => v + 120)} className="mira-button-secondary px-4 py-2 text-xs font-semibold">Load {Math.min(120, hiddenCount)} older messages ({hiddenCount} hidden)</button></div>}
          {compactionHint && <div className="mx-auto max-w-[760px] px-4 pb-2 text-[11px] text-slate-400">{compactionHint}</div>}
          {visibleMessages.map((message) => message.role === "assistant" && message.content === "" && message.isThinking ? <div key={message.id} className="mx-auto max-w-[760px] px-4 py-4"><div className="flex items-start gap-3"><div className="mt-1 flex h-7 w-7 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f2746,#3b82f6)] text-[10px] font-semibold tracking-[0.24em] text-white">M</div><div className="mira-surface flex-1 rounded-[1.5rem] px-5 py-4"><p className="text-sm text-slate-500">Thinking...</p>{thinkingPreview && <p className="mt-2 text-xs text-slate-400">{thinkingPreview}</p>}{activeTools.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{activeTools.map((tool) => <span key={tool} className="mira-pill bg-slate-100 text-slate-600">tool: {tool}</span>)}</div>}</div></div></div> : (message.role === "assistant" && message.content === "") ? null : <ChatMessage key={message.id} message={message} />)}
          {isLoading && !isStreaming && messages.length > 0 && !messages.some((m) => m.role === "assistant" && m.isThinking) && <div className="mx-auto max-w-[760px] px-4 py-4 text-sm text-slate-500">Mira is responding...</div>}
          <div ref={messagesEndRef} />
        </div>

        {artifacts.length > 0 && agentId && <div className="border-t border-slate-200/50 bg-white/60 px-4 py-3 backdrop-blur-xl"><div className="mx-auto max-w-[760px]"><p className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">Generated artifacts</p><div className="flex flex-wrap gap-2">{artifacts.map((a) => <a key={a.name} href={`/api/artifacts/${encodeURIComponent(a.name)}?agentId=${encodeURIComponent(agentId)}`} className="mira-button-secondary px-3 py-1.5 text-xs font-semibold">{a.name}</a>)}</div></div></div>}
        <ChatInput onSend={handleSend} onFilesAttached={addDocuments} disabled={isLoading} />
      </div>
      {showDocPanel && agentId && <><div className="fixed inset-0 z-40 bg-slate-950/20 lg:hidden" onClick={() => setShowDocPanel(false)} /><div className="fixed right-0 top-0 bottom-0 z-50 w-80 shadow-xl lg:relative lg:z-auto lg:flex-shrink-0 lg:shadow-none"><DocumentPanel agentId={agentId} documents={documents} setDocuments={setDocuments} onClose={() => setShowDocPanel(false)} /></div></>}
    </div>
  );
}
