"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ChatMessage, { Message } from "./ChatMessage";
import ChatInput from "./ChatInput";
import DocumentPanel, { UploadedDoc } from "./DocumentPanel";

function stripControlTokens(text: string): string {
  return text
    .replace(/\[\[\s*reply_to[:\s][^\]]*\]\]/gi, "")
    .replace(/\[\[\s*reply_to_current\s*\]\]/gi, "")
    .replace(/\bNO_REPLY\b/g, "")
    .replace(/\bHEARTBEAT_OK\b/g, "");
}

function sanitizeContent(text: string): string {
  return stripControlTokens(text).trim();
}

function mergeAssistantContent(current: string, incoming: string): string {
  const sanitizedCurrent = sanitizeContent(current);
  const sanitizedIncoming = sanitizeContent(incoming);

  if (!sanitizedIncoming) return sanitizedCurrent;
  if (!sanitizedCurrent) return sanitizedIncoming;
  if (sanitizedIncoming === sanitizedCurrent) return sanitizedCurrent;
  if (sanitizedIncoming.startsWith(sanitizedCurrent)) return sanitizedIncoming;
  if (sanitizedCurrent.endsWith(sanitizedIncoming)) return sanitizedCurrent;

  return sanitizeContent(`${current}${stripControlTokens(incoming)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendChatMessageStream(message: string, sessionId: string | null, onDelta: (text: string) => void, onThinking?: (text: string) => void, onTool?: (name: string) => void, onArtifacts?: (artifacts: Array<{ name: string; size: number; createdAt: string }>) => void): Promise<{ sessionId: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, stream: false }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  const data = await res.json().catch(() => ({}));
  const finalText = typeof data.response === "string" ? data.response : "";
  if (finalText) onDelta(finalText);

  if (onArtifacts && sessionId?.startsWith("agent:")) {
    const agentId = sessionId.split(":")[1];
    if (agentId) {
      try {
        const artifactsRes = await fetch(`/api/artifacts?agentId=${encodeURIComponent(agentId)}`);
        if (artifactsRes.ok) {
          const artifacts = await artifactsRes.json();
          if (Array.isArray(artifacts)) onArtifacts(artifacts);
        }
      } catch {}
    }
  }

  return { sessionId: typeof data.sessionId === "string" ? data.sessionId : (sessionId || "") };
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
  useEffect(() => {
    if (!agentId) return;
    const expectedPrefix = `agent:${agentId}:webchat:`;
    if (!sessionId) {
      setSessionId(`agent:${agentId}:webchat:default`);
      setHasOnboarded(false);
      setMessages([]);
      setCompactionHint('');
      return;
    }

    // Allow canonical persisted session keys (UUIDs) returned by chat history.
    // Only reset when we still have an agent-prefixed session for the wrong agent.
    if (sessionId.startsWith('agent:') && !sessionId.startsWith(expectedPrefix)) {
      setSessionId(`agent:${agentId}:webchat:default`);
      setHasOnboarded(false);
      setMessages([]);
      setCompactionHint('');
    }
  }, [agentId, sessionId]);
  useEffect(() => { if (agentId) fetch(`/api/artifacts?agentId=${encodeURIComponent(agentId)}`).then((res) => (res.ok ? res.json() : [])).then((data) => { if (Array.isArray(data)) setArtifacts(data); }).catch(() => undefined); }, [agentId]);
  const fetchHistory = useCallback(async (targetSessionId: string | null) => {
    if (!targetSessionId) {
      return { sessionKey: null, messages: [] as Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: string }> };
    }
    const res = await fetch(`/api/chat/history?sessionId=${encodeURIComponent(targetSessionId)}`);
    const data = await res.json();
    const normalizedMessages = Array.isArray(data.messages)
      ? data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; timestamp: string }) => ({
          id: m.id,
          role: m.role,
          content: m.role === "assistant" ? sanitizeContent(m.content) : m.content,
          timestamp: m.timestamp,
        }))
      : [];
    return {
      sessionKey: typeof data.sessionKey === "string" && data.sessionKey.length > 0 ? data.sessionKey : targetSessionId,
      messages: normalizedMessages,
    };
  }, []);

  const applyHistory = useCallback((history: { sessionKey: string | null; messages: Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: string }> }) => {
    if (history.sessionKey && history.sessionKey.length > 0) setSessionId(history.sessionKey);
    if (history.messages.length > 0) {
      setMessages(history.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
      if (history.messages.length >= 95) setCompactionHint("Older context may be compacted by the engine to keep chat fast.");
      else setCompactionHint("");
    } else {
      setMessages([]);
      setCompactionHint("");
    }
  }, []);

  const loadHistory = useCallback(async (targetSessionId: string | null) => {
    if (!targetSessionId) {
      setMessages([]);
      setCompactionHint('');
      return;
    }
    const history = await fetchHistory(targetSessionId);
    applyHistory(history);
  }, [fetchHistory, applyHistory]);

  useEffect(() => {
    if (hasOnboarded) return; setHasOnboarded(true);
    if (!sessionId) { setMessages([]); return; }
    loadHistory(sessionId).catch(() => { setMessages([]); setCompactionHint(""); });
  }, [hasOnboarded, sessionId, loadHistory]);

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
      const result = await sendChatMessageStream(messageToSend, sessionId, (delta) => { if (!receivedFirstDelta) { receivedFirstDelta = true; setIsStreaming(true); } setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: mergeAssistantContent(m.content, delta), isThinking: false } : m)); }, (thinkingText) => setThinkingPreview(thinkingText.slice(0, 240)), (toolName) => setActiveTools((prev) => prev.includes(toolName) ? prev : [...prev, toolName]), (newArtifacts) => setArtifacts((prev) => { const existing = new Set(prev.map((a) => a.name)); const merged = [...prev]; for (const a of newArtifacts) if (!existing.has(a.name)) merged.unshift(a); return merged; }));
      if (result.sessionId) setSessionId(result.sessionId);
    } catch (err) {
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `Warning: ${err instanceof Error ? err.message : "Failed to get response"}. Please try again.`, isThinking: false } : m));
      try {
        await sleep(1200);
      } catch {}
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
