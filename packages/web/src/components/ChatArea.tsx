"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ChatMessage, { Message } from "./ChatMessage";
import ChatInput from "./ChatInput";
import DocumentPanel, { UploadedDoc } from "./DocumentPanel";

// Strip internal engine tags that shouldn't be shown to users
function sanitizeContent(text: string): string {
  return text
    .replace(/\[\[\s*reply_to[:\s][^\]]*\]\]/gi, '')
    .replace(/\[\[\s*reply_to_current\s*\]\]/gi, '')
    .replace(/\bNO_REPLY\b/g, '')
    .replace(/\bHEARTBEAT_OK\b/g, '')
    .trim();
}

// Streaming: calls onDelta for each chunk, returns final text
async function sendChatMessageStream(
  message: string,
  sessionId: string | null,
  onDelta: (text: string) => void,
  onThinking?: (text: string) => void,
  onTool?: (name: string) => void,
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
        } else if (data.type === "thinking" && data.text && onThinking) {
          onThinking(data.text);
        } else if (data.type === "tool" && data.name && onTool) {
          onTool(data.name);
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
  const [thinkingPreview, setThinkingPreview] = useState<string>("");
  const [activeTools, setActiveTools] = useState<string[]>([]);
  // Session key routes to the assigned agent
  const [sessionId, setSessionId] = useState<string | null>(
    agentId ? `agent:${agentId}:webchat:default` : null
  );
  const [engineStatus, setEngineStatus] = useState<"mock" | "connected" | "checking">("checking");
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(120);
  const [compactionHint, setCompactionHint] = useState<string>("");
  // Track files that were uploaded since the last message was sent
  const [knownFileNames, setKnownFileNames] = useState<Set<string>>(new Set());
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

  // If agent assignment arrives after initial render, bind the session to that agent.
  // This prevents fallback to generic `webchat:*` sessions (which can hit wrong/default agent model).
  useEffect(() => {
    if (!agentId) return;
    const expected = `agent:${agentId}:webchat:default`;
    if (sessionId !== expected && messages.length === 0) {
      setSessionId(expected);
      setHasOnboarded(false);
    }
  }, [agentId, sessionId, messages.length]);

  // Load chat history from engine on mount, fall back to welcome message
  useEffect(() => {
    if (hasOnboarded) return;
    setHasOnboarded(true);

    if (!sessionId) {
      // No session yet — show empty state, agent will onboard on first message
      setMessages([]);
      return;
    }

    fetch(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; timestamp: string }) => ({
            id: m.id,
            role: m.role,
            content: m.role === "assistant" ? sanitizeContent(m.content) : m.content,
            timestamp: new Date(m.timestamp),
          })));
          if (data.messages.length >= 95) {
            setCompactionHint("Older context may be compacted by the engine to keep chat fast.");
          }
        } else {
          setMessages([]);
        }
      })
      .catch(() => {
        setMessages([]);
      });
  }, [hasOnboarded, sessionId]);

  // Upload a file to the server immediately
  const uploadFile = useCallback(
    async (file: File) => {
      if (!agentId) return;

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
      setShowDocPanel(true);

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
    [agentId]
  );

  const addDocuments = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((file) => uploadFile(file));
    },
    [uploadFile]
  );

  const handleSend = useCallback(
    async (content: string) => {
      // Build file context for new uploads
      const completedDocs = documents.filter((d) => d.status === "done");
      const newFiles = completedDocs.filter((d) => !knownFileNames.has(d.name));

      let messageToSend = content;

      if (newFiles.length > 0) {
        const fileList = newFiles
          .map((f) => `${f.name} (at files/${f.name})`)
          .join(", ");
        const context = `[Context: The user has uploaded the following files to their workspace: ${fileList}. You can use the PDF extract skill to read PDFs, or read other files directly.]`;
        messageToSend = `${context}\n\n${content}`;
      }

      // Mark all current files as known
      setKnownFileNames(new Set(completedDocs.map((d) => d.name)));

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setThinkingPreview("");
      setActiveTools([]);

      // Create a placeholder assistant message for streaming
      const assistantId = crypto.randomUUID();
      let receivedFirstDelta = false;

      try {
        // Add placeholder assistant message — initially null content to avoid flicker
        // We'll only show the message once we receive the first delta OR when streaming starts
        setMessages((prev) => [...prev, {
          id: assistantId,
          role: "assistant" as const,
          content: "",
          timestamp: new Date(),
          isThinking: true, // Mark as thinking until first delta
        }]);

        const result = await sendChatMessageStream(
          messageToSend,
          sessionId,
          (delta) => {
            if (!receivedFirstDelta) {
              receivedFirstDelta = true;
              setIsStreaming(true);
            }
            // Gateway sends cumulative text — REPLACE content, don't append
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: sanitizeContent(delta), isThinking: false }
                  : m
              )
            );
          },
          (thinkingText) => {
            setThinkingPreview(thinkingText.slice(0, 240));
          },
          (toolName) => {
            setActiveTools((prev) => (prev.includes(toolName) ? prev : [...prev, toolName]));
          }
        );

        if (result.sessionId) setSessionId(result.sessionId);
      } catch (err) {
        // If streaming fails, update the placeholder with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${err instanceof Error ? err.message : "Failed to get response"}. Please try again.`, isThinking: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        setThinkingPreview("");
        setActiveTools([]);
      }
    },
    [sessionId, documents, knownFileNames]
  );

  const docCount = documents.filter((d) => d.status === "done").length;

  const visibleMessages = useMemo(() => {
    if (messages.length <= visibleCount) return messages;
    return messages.slice(messages.length - visibleCount);
  }, [messages, visibleCount]);

  const hiddenCount = Math.max(0, messages.length - visibleMessages.length);

  // No agent assigned — show friendly message
  if (!agentId) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center space-y-4 px-6 max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 flex items-center justify-center text-2xl mx-auto">
            🏗️
          </div>
          <h2 className="text-xl font-semibold text-[#171717]">No Agent Assigned</h2>
          <p className="text-sm text-[#8e8e8e] leading-relaxed">
            An admin needs to create an agent and assign it to your account before you can start chatting.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Waiting for agent assignment
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main chat */}
      <div className="flex flex-col flex-1 min-w-0 bg-white">
        {/* Minimal header — ChatGPT style */}
        <header className="flex items-center justify-between pl-14 pr-4 lg:px-4 py-2.5 border-b border-black/5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#171717]">BuildAI</h2>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              engineStatus === "connected"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-amber-50 text-amber-600 border border-amber-200"
            }`}>
              <span className={`w-1 h-1 rounded-full ${engineStatus === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />
              {engineStatus === "connected" ? "Connected" : engineStatus === "checking" ? "..." : "Preview"}
            </span>
          </div>

          <button
            onClick={() => setShowDocPanel(!showDocPanel)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showDocPanel
                ? "bg-black/[0.07] text-[#171717]"
                : "text-[#8e8e8e] hover:text-[#171717] hover:bg-black/[0.04]"
            }`}
            title="Toggle documents panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">Docs</span>
            {docCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-[#171717] text-white rounded-full">
                {docCount}
              </span>
            )}
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div>
            {/* Empty state — ChatGPT style */}
            {messages.length === 0 && !isLoading && (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center space-y-3 px-4">
                  <div className="w-10 h-10 rounded-full bg-[#171717] flex items-center justify-center text-white text-sm font-bold mx-auto">
                    B
                  </div>
                  <h2 className="text-2xl font-semibold text-[#171717]">What can I help with?</h2>
                  <p className="text-[#8e8e8e] text-sm max-w-md">Your AI construction PM assistant</p>
                </div>
              </div>
            )}

            {hiddenCount > 0 && (
              <div className="max-w-[680px] mx-auto px-4 py-2">
                <button
                  onClick={() => setVisibleCount((v) => v + 120)}
                  className="text-xs rounded-lg border border-black/10 px-3 py-1.5 text-[#666] hover:text-[#171717]"
                >
                  Load {Math.min(120, hiddenCount)} older messages ({hiddenCount} hidden)
                </button>
              </div>
            )}

            {compactionHint && (
              <div className="max-w-[680px] mx-auto px-4 pb-2">
                <p className="text-[11px] text-[#8a8a8a]">🧠 {compactionHint}</p>
              </div>
            )}

            {visibleMessages.map((message) => {
              // Show thinking indicator for assistant messages that haven't received content yet
              if (message.role === "assistant" && message.content === "" && message.isThinking) {
                return (
                  <div key={message.id} className="py-4">
                    <div className="max-w-[680px] mx-auto flex gap-3 px-4">
                      <div className="w-6 h-6 rounded-full bg-[#171717] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        B
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-[#c4c4c4] rounded-full animate-pulse"></span>
                            <span className="w-1.5 h-1.5 bg-[#c4c4c4] rounded-full animate-pulse [animation-delay:300ms]"></span>
                            <span className="w-1.5 h-1.5 bg-[#c4c4c4] rounded-full animate-pulse [animation-delay:600ms]"></span>
                          </div>
                          <span className="text-xs text-[#b4b4b4] italic">Thinking...</span>
                        </div>
                        {thinkingPreview && (
                          <p className="mt-2 text-[11px] text-[#9a9a9a] line-clamp-2">
                            {thinkingPreview}
                          </p>
                        )}
                        {activeTools.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {activeTools.map((tool) => (
                              <span
                                key={tool}
                                className="inline-flex items-center rounded-full bg-[#f4f4f4] px-2 py-0.5 text-[10px] text-[#666]"
                              >
                                tool: {tool}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Hide empty assistant messages that aren't thinking
              if (message.role === "assistant" && message.content === "") return null;

              return <ChatMessage key={message.id} message={message} />;
            })}

            {/* Loading indicator shown before the assistant placeholder is created */}
            {isLoading && !isStreaming && messages.length > 0 && !messages.some(m => m.role === "assistant" && m.isThinking) && (
              <div className="py-4">
                <div className="max-w-[680px] mx-auto flex gap-3 px-4">
                  <div className="w-6 h-6 rounded-full bg-[#171717] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    B
                  </div>
                  <div className="flex-1">
                    <div className="flex gap-1 pt-2">
                      <span className="w-2 h-2 bg-[#d1d1d1] rounded-full animate-bounce [animation-delay:0ms]"></span>
                      <span className="w-2 h-2 bg-[#d1d1d1] rounded-full animate-bounce [animation-delay:150ms]"></span>
                      <span className="w-2 h-2 bg-[#d1d1d1] rounded-full animate-bounce [animation-delay:300ms]"></span>
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
      {showDocPanel && agentId && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setShowDocPanel(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-80 z-50 lg:relative lg:z-auto lg:w-80 lg:flex-shrink-0 shadow-xl lg:shadow-none">
            <DocumentPanel
              agentId={agentId}
              documents={documents}
              setDocuments={setDocuments}
              onClose={() => setShowDocPanel(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
