"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* --------------------------------- Button --------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "xs" | "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-sm hover:brightness-110 active:brightness-95 border border-transparent",
  secondary:
    "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-muted",
  soft: "bg-surface-muted text-ink border border-transparent hover:bg-line/60",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-surface-muted border border-transparent",
  danger:
    "bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/25 hover:bg-rose-500/18",
};

const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-[12px] gap-1 rounded-lg",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
};

export function Button({
  variant = "secondary",
  size = "sm",
  className,
  children,
  title,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      title={title}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45",
        "disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  className,
  title,
  variant = "secondary",
  size = "sm",
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
  variant?: Variant;
  size?: Size;
  onClick?: () => void;
}) {
  const external = /^https?:/i.test(href);
  return (
    <a
      href={href}
      title={title}
      onClick={onClick}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </a>
  );
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  children,
  className,
  hover,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={cn("card", hover && "card-hover", className)}>{children}</div>;
}

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "accent" | "success" | "warn" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-muted text-muted",
    accent: "bg-accent/10 text-accent",
    success: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    warn: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
    danger: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------- Inputs --------------------------------- */

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("field", className)} {...rest} />;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[11px] font-semibold tracking-wide text-subtle uppercase",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] sm:text-[30px]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon = "✨",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-2xl">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
