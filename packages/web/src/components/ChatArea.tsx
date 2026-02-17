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

export default function ChatArea() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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

      // TODO: Replace with actual engine API call
      // For now, simulate a response
      setTimeout(() => {
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `I received your message: "${content}"\n\n⚠️ Engine not connected yet. This is a UI preview — the actual engine integration is coming in Phase 2.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 800);
    },
    []
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Preview Mode
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
