"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "info" | "success" | "error" };

const ToastContext = createContext<{
  toast: (message: string, tone?: Toast["tone"]) => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[140] flex flex-col items-center gap-2 px-3 md:bottom-5">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-pop-in glass pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-center text-[13.5px] font-medium shadow-lg sm:rounded-full sm:text-sm",
              t.tone === "success" && "text-emerald-600 dark:text-emerald-300",
              t.tone === "error" && "text-rose-600 dark:text-rose-300",
            )}
          >
            <span>
              {t.tone === "success" ? "✓" : t.tone === "error" ? "⚠" : "•"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
