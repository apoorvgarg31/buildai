import { notFound } from "next/navigation";
import SettingsPage from "@/components/SettingsPage";

export default function SettingsPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff,#f8fbff)]">
      <SettingsPage />
    </div>
  );
}
