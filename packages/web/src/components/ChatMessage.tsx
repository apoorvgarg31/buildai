"use client";

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
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Agent avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-1">
          B
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-amber-500 text-white rounded-br-sm"
            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm border border-gray-100 dark:border-gray-700 rounded-bl-sm"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </p>
        <p
          className={`text-xs mt-1.5 ${
            isUser ? "text-amber-200" : "text-gray-400"
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-1">
          PM
        </div>
      )}
    </div>
  );
}
