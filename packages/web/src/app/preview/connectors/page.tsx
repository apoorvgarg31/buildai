import { notFound } from "next/navigation";
import ConnectorsPage from "@/components/ConnectorsPage";

export default function ConnectorsPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ConnectorsPage />;
}
