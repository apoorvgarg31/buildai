"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage, { Message } from "./ChatMessage";
import ChatInput from "./ChatInput";
import DocumentPanel, { UploadedDoc } from "./DocumentPanel";

// Dynamic onboarding — agent scans projects on first load
const ONBOARDING_TRIGGER = "I just logged in. Run a full project health scan: query the database for all active projects, check for overdue RFIs, expiring insurance, and budget overruns. Show me a complete health dashboard.";

async function sendChatMessage(
  message: string,
  sessionId: string | null
): Promise<{ response: string; sessionId: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export default function ChatArea() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
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
        // Engine can be 'connected', 'configured', or 'fallback'
        setEngineStatus(data.engine === "connected" ? "connected" : "mock");
      })
      .catch(() => {
        setEngineStatus("mock");
      });
  }, []);

  // Auto-onboard: trigger a real project health scan on first load
  useEffect(() => {
    if (hasOnboarded) return;
    setHasOnboarded(true);
    setIsLoading(true);

    sendChatMessage(ONBOARDING_TRIGGER, null)
      .then((data) => {
        if (data.sessionId) setSessionId(data.sessionId);
        setMessages([{
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        }]);
      })
      .catch(() => {
        setMessages([{
          id: "welcome-fallback",
          role: "assistant",
          content: `Hey! I'm your **BuildAI assistant** — your personal construction PM copilot. 🏗️\n\nI can help you with RFIs, budgets, schedules, documents, and more. What are you working on today?`,
          timestamp: new Date(),
        }]);
      })
      .finally(() => setIsLoading(false));
  }, [hasOnboarded]);

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

      try {
        const data = await sendChatMessage(content, sessionId);
        if (data.sessionId) setSessionId(data.sessionId);

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ ${err instanceof Error ? err.message : "Failed to get response"}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
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
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {isLoading && (
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
