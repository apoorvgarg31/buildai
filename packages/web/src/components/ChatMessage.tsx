"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isThinking?: boolean;
}

interface ChatMessageProps { message: Message; }

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className="py-3">
      <div className={`mx-auto max-w-[760px] px-4 ${isUser ? "flex justify-end" : ""}`}>
        {isUser ? (
          <div className="max-w-[85%] rounded-[1.7rem] border border-slate-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(240,247,255,0.88))] px-5 py-3 text-slate-900 shadow-[0_18px_36px_rgba(148,163,184,0.12)]">
            <div className="text-[15px] leading-[1.8] whitespace-pre-wrap">{message.content}</div>
          </div>
        ) : (
          <div className="max-w-full">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f2746,#3b82f6)] text-[10px] font-semibold tracking-[0.24em] text-white shadow-[0_12px_24px_rgba(59,130,246,0.22)]">M</div>
              <div className="mira-surface min-w-0 flex-1 rounded-[1.5rem] px-5 py-4 prose prose-sm max-w-none prose-p:my-2 prose-p:text-[15px] prose-p:leading-[1.8] prose-p:text-slate-800 prose-strong:text-slate-950 prose-li:text-slate-800 prose-li:text-[15px] prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-pre:rounded-2xl prose-pre:border prose-pre:border-slate-200 prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-headings:text-slate-950 prose-a:text-blue-700 prose-th:border prose-th:border-slate-200 prose-th:bg-slate-50 prose-td:border prose-td:border-slate-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
      <p className={`mx-auto mt-1 max-w-[760px] px-4 text-[11px] text-slate-400 ${isUser ? "text-right pr-6" : "pl-[56px]"}`}>
        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
