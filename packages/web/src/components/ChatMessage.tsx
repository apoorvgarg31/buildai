"use client";

import ReactMarkdown from "react-markdown";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`group py-4 ${isUser ? "" : ""}`}>
      <div className="max-w-3xl mx-auto flex gap-4 px-4">
        {/* Avatar */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5 ${
            isUser
              ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
              : "bg-gradient-to-br from-emerald-400 to-teal-600 text-white"
          }`}
        >
          {isUser ? "Y" : "B"}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold mb-1 ${isUser ? "text-gray-300" : "text-gray-300"}`}>
            {isUser ? "You" : "BuildAI"}
          </p>
          <div
            className={`prose prose-sm prose-invert max-w-none
              prose-p:text-gray-200 prose-p:leading-relaxed prose-p:my-1.5
              prose-strong:text-white prose-strong:font-semibold
              prose-li:text-gray-200 prose-li:my-0.5
              prose-ul:my-2 prose-ol:my-2
              prose-code:text-amber-300 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px]
              prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-lg
              prose-headings:text-white prose-headings:font-semibold
              prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline
              ${isUser ? "text-gray-200" : "text-gray-200"}
            `}
          >
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
          <p className="text-[11px] text-gray-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
