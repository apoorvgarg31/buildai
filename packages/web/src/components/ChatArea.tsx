"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage, { Message } from "./ChatMessage";
import ChatInput from "./ChatInput";
import DocumentPanel, { UploadedDoc } from "./DocumentPanel";

// Simple welcome — no heavy auto-scan on load
const WELCOME_MESSAGE = `Welcome to **BuildAI** 🏗️\n\nI'm your construction PM copilot. I can help you with:\n\n- 📋 **RFIs** — track, query, and manage\n- 💰 **Budgets** — line items, change orders\n- 📅 **Schedules** — tasks and milestones\n- 📄 **Documents** — search and organize\n- 🔗 **Procore** — live project data\n\nWhat would you like to work on?`;

// Non-streaming fallback
async function sendChatMessage(
  message: string,
  sessionId: string | null
): Promise<{ response: string; sessionId: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, stream: false }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Streaming: calls onDelta for each chunk, returns final text
async function sendChatMessageStream(
  message: string,
  sessionId: string | null,
  onDelta: (text: string) => void,
): Promise<{ sessionId: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, stream: true }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let returnedSessionId = sessionId || "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === "delta" && data.text) {
          onDelta(data.text);
        } else if (data.type === "done") {
          returnedSessionId = data.sessionId || returnedSessionId;
        } else if (data.type === "error") {
          throw new Error(data.message || "Stream error");
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Stream error") continue;
        throw e;
      }
    }
  }

  return { sessionId: returnedSessionId };
}

interface ChatAreaProps {
  agentId?: string;
}

export default function ChatArea({ agentId }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // Session key routes to the assigned agent
  const [sessionId, setSessionId] = useState<string | null>(
    agentId ? `agent:${agentId}:webchat:default` : null
  );
  const [engineStatus, setEngineStatus] = useState<"mock" | "connected" | "checking">("checking");
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data) => {
        setEngineStatus(data.status === "ok" ? "connected" : "mock");
      })
      .catch(() => {
        setEngineStatus("mock");
      });
  }, []);

  // Load chat history from engine on mount, fall back to welcome message
  useEffect(() => {
    if (hasOnboarded) return;
    setHasOnboarded(true);

    if (!sessionId) {
      setMessages([{ id: "welcome", role: "assistant", content: WELCOME_MESSAGE, timestamp: new Date() }]);
      return;
    }

    fetch(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; timestamp: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
          })));
        } else {
          setMessages([{ id: "welcome", role: "assistant", content: WELCOME_MESSAGE, timestamp: new Date() }]);
        }
      })
      .catch(() => {
        setMessages([{ id: "welcome", role: "assistant", content: WELCOME_MESSAGE, timestamp: new Date() }]);
      });
  }, [hasOnboarded, sessionId]);

  const addDocuments = useCallback((files: FileList) => {
    const newDocs: UploadedDoc[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date(),
      url: URL.createObjectURL(file),
    }));
    setDocuments((prev) => [...prev, ...newDocs]);
    setShowDocPanel(true);
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => {
      const doc = prev.find((d) => d.id === id);
      if (doc?.url) URL.revokeObjectURL(doc.url);
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Create a placeholder assistant message for streaming
      const assistantId = crypto.randomUUID();

      try {
        // Add empty assistant message that we'll fill with streaming content
        setMessages((prev) => [...prev, {
          id: assistantId,
          role: "assistant" as const,
          content: "",
          timestamp: new Date(),
        }]);

        const result = await sendChatMessageStream(content, sessionId, (delta) => {
          // First delta received — we're streaming now, hide loading dots
          setIsStreaming(true);
          // Gateway sends cumulative text — REPLACE content, don't append
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: delta } : m
            )
          );
        });

        if (result.sessionId) setSessionId(result.sessionId);
      } catch (err) {
        // If streaming fails, update the placeholder with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${err instanceof Error ? err.message : "Failed to get response"}. Please try again.` }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [sessionId]
  );

  const docCount = documents.length;

  return (
    <div className="flex h-full">
      {/* Main chat */}
      <div className="flex flex-col flex-1 min-w-0 bg-gray-900">
        {/* Minimal header */}
        <header className="flex items-center justify-between pl-14 pr-4 lg:px-4 py-2.5 border-b border-gray-800/80">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-200">BuildAI</h2>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              engineStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}>
              <span className={`w-1 h-1 rounded-full ${engineStatus === "connected" ? "bg-emerald-400" : "bg-amber-400"}`} />
              {engineStatus === "connected" ? "Connected" : engineStatus === "checking" ? "..." : "Preview"}
            </span>
          </div>

          <button
            onClick={() => setShowDocPanel(!showDocPanel)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showDocPanel
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
            title="Toggle documents panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">Docs</span>
            {docCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                {docCount}
              </span>
            )}
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-800/50">
            {messages.map((message) => {
              // Hide empty placeholder message before streaming starts
              if (message.role === "assistant" && message.content === "" && !isStreaming) return null;
              return <ChatMessage key={message.id} message={message} />;
            })}

            {isLoading && !isStreaming && (
              <div className="py-4">
                <div className="max-w-3xl mx-auto flex gap-4 px-4">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    B
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-gray-300 mb-2">BuildAI</p>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:0ms]"></span>
                      <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:150ms]"></span>
                      <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:300ms]"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} onFilesAttached={addDocuments} disabled={isLoading} />
      </div>

      {/* Document panel */}
      {showDocPanel && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setShowDocPanel(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-80 z-50 lg:relative lg:z-auto lg:w-80 lg:flex-shrink-0 shadow-xl lg:shadow-none">
            <DocumentPanel documents={documents} onRemove={removeDocument} onAdd={addDocuments} onClose={() => setShowDocPanel(false)} />
          </div>
        </>
      )}
    </div>
  );
}
