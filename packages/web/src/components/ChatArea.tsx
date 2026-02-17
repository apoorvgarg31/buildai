"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage, { Message } from "./ChatMessage";
import ChatInput from "./ChatInput";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: `Hey! I'm your BuildAI assistant — your personal construction PM copilot. 🏗️

I can help you with:
• **RFIs & Submittals** — track, create, follow up
• **Budget & Costs** — real-time cost code analysis
• **Schedule** — critical path, milestones, delays
• **Documents** — search contracts, specs, drawings
• **Daily Logs** — review and create entries

I'll also proactively alert you about overdue items, expiring certs, and budget issues.

What are you working on today?`,
  timestamp: new Date(),
};

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
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<"mock" | "connected" | "checking">("checking");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Check engine status on mount
  useEffect(() => {
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data) => {
        setEngineStatus(data.engine === "connected" ? "connected" : "mock");
      })
      .catch(() => {
        setEngineStatus("mock");
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

        // Store session ID for continuity
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }

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
          content: `⚠️ Error: ${err instanceof Error ? err.message : "Failed to get response"}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Chat
          </h2>
          <p className="text-xs text-gray-500">
            Your personal construction PM assistant
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              engineStatus === "connected"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                engineStatus === "connected" ? "bg-green-500" : "bg-amber-500"
              }`}
            ></span>
            {engineStatus === "connected" ? "Engine Connected" : engineStatus === "checking" ? "Connecting..." : "Preview Mode"}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                B
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
