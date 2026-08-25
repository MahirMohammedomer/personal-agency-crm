"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "./primitives";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const widths = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  const node = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="animate-fade-in absolute inset-0 bg-black/45 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-pop-in relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:rounded-2xl",
          widths[size],
        )}
      >
        {title ? (
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
              {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
            </div>
            <button
              onClick={onClose}
              className="-mr-1 rounded-lg p-1.5 text-subtle transition-colors hover:bg-surface-muted hover:text-ink"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-muted/60 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={title}
      size="sm"
      footer={
        <>
          <Button size="md" variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            variant={destructive ? "danger" : "primary"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{message}</p>
      {error ? (
        <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-[13px] text-rose-600 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
