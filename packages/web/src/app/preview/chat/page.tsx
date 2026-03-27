import { notFound } from "next/navigation";
import ChatArea from "@/components/ChatArea";

export default function ChatPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f7fb,#fbfdff)] p-6">
      <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/80 shadow-[0_24px_80px_rgba(15,39,70,0.12)] backdrop-blur-xl">
        <ChatArea agentId="agent-preview" />
      </div>
    </div>
  );
}
