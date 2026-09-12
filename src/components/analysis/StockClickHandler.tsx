// components/analysis/StockClickHandler.tsx
"use client";

import React from "react";

interface StockClickHandlerProps {
  symbol: string;
  children: React.ReactNode;
  onStockClick: (symbol: string) => void;
}

export function StockClickHandler({
  symbol,
  children,
  onStockClick,
}: StockClickHandlerProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer"
      onClick={() => onStockClick(symbol)}
      onKeyDown={(e) => e.key === "Enter" && onStockClick(symbol)}
    >
      {children}
    </div>
  );
}
