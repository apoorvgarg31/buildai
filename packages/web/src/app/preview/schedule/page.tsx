import { notFound } from "next/navigation";
import SchedulePage from "@/components/SchedulePage";

export default function SchedulePreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff,#f8fbff)]">
      <SchedulePage />
    </div>
  );
}
