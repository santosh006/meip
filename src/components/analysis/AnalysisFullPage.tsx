// Usage inside your existing CustomerApp page
"use client";

import { useState } from "react";
import { StockClickHandler } from "@/components/analysis/StockClickHandler";
import { AnalysisOverlay } from "@/components/analysis/AnalysisOverlay";

type Stock = {
  symbol: string;
  company_name: string;
};

type Props = {
  stocks: Stock[];
};

export default function CustomerAppPage({ stocks }: Props) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  return (
    <div>
      {/* Your existing stock list */}
      {stocks.map((stock) => (
        <StockClickHandler
          key={stock.symbol}
          symbol={stock.symbol}
          onStockClick={setSelectedSymbol}
        >
          {/* Your existing stock row/card UI */}
          <div className="p-3 border-b hover:bg-gray-50">
            <span className="font-medium">{stock.symbol}</span>
            <span className="ml-2 text-gray-500">{stock.company_name}</span>
          </div>
        </StockClickHandler>
      ))}

      {/* Analysis Overlay — mounts when a stock is selected */}
      <AnalysisOverlay
        symbol={selectedSymbol}
        onClose={() => setSelectedSymbol(null)}
      />
    </div>
  );
}
