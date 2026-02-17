"use client";

export default function MarketplacePage() {
  return (
    <div className="flex flex-col h-full bg-white">
      <header className="flex items-center pl-14 pr-6 lg:px-6 h-14 border-b border-black/5 shrink-0">
        <h1 className="text-sm font-semibold text-[#171717]">Marketplace</h1>
      </header>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3 px-4">
          <div className="w-12 h-12 rounded-xl bg-[#f4f4f4] flex items-center justify-center text-2xl mx-auto">
            🛍️
          </div>
          <h2 className="text-lg font-semibold text-[#171717]">Skills Marketplace</h2>
          <p className="text-[#8e8e8e] text-sm max-w-sm">
            Browse and install integrations for your BuildAI assistant. Connect to Procore, P6, Unifier, and more.
          </p>
          <p className="text-[#b4b4b4] text-xs">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
