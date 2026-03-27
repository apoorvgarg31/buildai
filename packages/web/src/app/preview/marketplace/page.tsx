import { notFound } from "next/navigation";
import MarketplacePage from "@/components/MarketplacePage";

export default function MarketplacePreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <MarketplacePage />;
}
