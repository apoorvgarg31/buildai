"use client";

import { useState, useRef, useCallback } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onFilesAttached: (files: FileList) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, onFilesAttached, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  };

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFilesAttached(e.target.files);
        e.target.value = "";
      }
    },
    [onFilesAttached]
  );

  return (
    <div className="bg-white px-4 pb-4 pt-2">
      <div className="max-w-[680px] mx-auto">
        <div className="relative flex items-end bg-[#f4f4f4] rounded-3xl border border-transparent focus-within:border-[#d9d9d9] transition-colors">
          {/* Attach button */}
          <button
            onClick={handleFileClick}
            className="p-3 pl-4 text-[#8e8e8e] hover:text-[#171717] transition-colors"
            title="Attach documents"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp"
            onChange={handleFileChange}
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything"
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent py-3.5 pr-2 text-[15px] text-[#171717] placeholder-[#8e8e8e] focus:outline-none disabled:opacity-50 max-h-[200px]"
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className={`p-2 m-2 rounded-full transition-all ${
              input.trim() && !disabled
                ? "bg-[#171717] text-white hover:bg-[#333]"
                : "bg-[#d9d9d9] text-white cursor-not-allowed"
            }`}
            title="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4l0 16m0-16l-6 6m6-6l6 6" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
        </div>

        <p className="text-[11px] text-[#b4b4b4] text-center mt-2">
          BuildAI can make mistakes. Verify important project data.
        </p>
      </div>
    </div>
  );
}
