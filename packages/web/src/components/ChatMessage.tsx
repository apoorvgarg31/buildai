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
    <div className={`py-3 ${isUser ? "" : ""}`}>
      <div className={`max-w-[680px] mx-auto px-4 ${isUser ? "flex justify-end" : ""}`}>
        {isUser ? (
          /* User message: right-aligned gray bubble */
          <div className="max-w-[85%]">
            <div className="inline-block bg-[#f4f4f4] text-[#171717] rounded-3xl px-5 py-3">
              <div className="text-[15px] leading-[1.7] whitespace-pre-wrap">
                {message.content}
              </div>
            </div>
          </div>
        ) : (
          /* Assistant message: left-aligned, plain text, small icon */
          <div className="max-w-full">
            <div className="flex items-start gap-3">
              {/* Small BuildAI icon */}
              <div className="w-6 h-6 rounded-full bg-[#171717] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-1">
                B
              </div>
              <div
                className="flex-1 min-w-0 prose prose-sm max-w-none
                  prose-p:text-[#171717] prose-p:leading-[1.7] prose-p:my-2 prose-p:text-[15px]
                  prose-strong:text-[#171717] prose-strong:font-semibold
                  prose-li:text-[#171717] prose-li:my-0.5 prose-li:text-[15px] prose-li:leading-[1.7]
                  prose-ul:my-2 prose-ul:list-disc prose-ul:pl-4
                  prose-ol:my-2 prose-ol:pl-4
                  prose-code:text-[#171717] prose-code:bg-[#f4f4f4] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-normal
                  prose-pre:bg-[#f4f4f4] prose-pre:border prose-pre:border-[#e5e5e5] prose-pre:rounded-xl
                  prose-headings:text-[#171717] prose-headings:font-semibold
                  prose-a:text-[#171717] prose-a:no-underline prose-a:font-medium hover:prose-a:underline
                  text-[#171717]
                "
              >
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Timestamp hidden by default, shown on hover */}
      <div className="group">
        <p className={`text-[11px] text-[#b4b4b4] mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? "text-right pr-6" : "pl-[52px]"} max-w-[680px] mx-auto px-4`}>
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
