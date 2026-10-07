"use client";

import React, { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  Send,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button, Dropdown, MenuItem, MenuLabel } from "@/components/ui/ui";
import {
  FacebookIcon as Facebook,
  InstagramIcon as Instagram,
  LinkedinIcon as Linkedin,
  TiktokIcon as Music2,
} from "@/components/ui/socials";
import { useToast } from "@/components/ui/toast";
import { apiPatch } from "@/lib/api";
import {
  buildLeadInfoText,
  copyText,
  ensureUrl,
  googleImagesUrl,
  googleSearchUrl,
  mapsHref,
  socialUrl,
  telegramHref,
  telHref,
  whatsappHref,
} from "@/lib/utils";
import type { Lead } from "@/lib/types";
import { WebsiteBriefDialog } from "@/components/leads/WebsiteBriefDialog";

export function useCopy() {
  const { toast } = useToast();
  return async (text: string, label = "Copied") => {
    const ok = await copyText(text);
    if (ok) toast(label, "success");
    else toast("Copy failed — long-press to copy manually", "error");
    return ok;
  };
}

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  target?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  active?: boolean;
  className?: string;
}

export function ActionBtn({
  icon,
  label,
  onClick,
  href,
  target = "_blank",
  disabled,
  size = "sm",
  active,
  className,
}: ActionBtnProps) {
  // Icon-only actions — the label stays in title/aria for accessibility.
  const cls = size === "sm" ? "h-9 w-9 shrink-0 rounded-lg p-0" : "h-11 w-11 shrink-0 rounded-xl p-0";
  const content = (
    <Button
      variant={active ? "secondary" : "outline"}
      className={`${cls} font-medium ${active ? "ring-1 ring-slate-900/20 dark:ring-white/20" : ""} ${className ?? ""}`}
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      {icon}
    </Button>
  );
  if (href && !disabled) {
    return (
      <a href={href} target={target} rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} title={label}>
        {content}
      </a>
    );
  }
  return content;
}

/** Telegram chat: username link when we have one, otherwise the phone deep-link. */
export function TelegramButton({ lead, size = "sm" }: { lead: Lead; size?: "sm" | "md" }) {
  const copy = useCopy();
  const usernameUrl = socialUrl("telegram", lead.telegram);
  const phoneUrl = telegramHref(lead.phone);
  const url = usernameUrl ?? phoneUrl;
  if (!url) return null;

  if (usernameUrl) {
    return (
      <a href={url} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
        <ActionBtn size={size} icon={<Send className="h-3.5 w-3.5" />} label="Telegram" />
      </a>
    );
  }

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <ActionBtn
          size={size}
          icon={<Send className="h-3.5 w-3.5" />}
          label="Telegram"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }}
        />
      )}
      panelClassName="w-56"
    >
      {({ close }) => (
        <>
          <MenuLabel>Telegram for {lead.businessName || "lead"}</MenuLabel>
          <MenuItem
            icon={<Send className="h-4 w-4" />}
            onClick={() => {
              window.location.href = url;
              close();
            }}
          >
            Open Telegram app
          </MenuItem>
          <MenuItem
            icon={<Globe className="h-4 w-4" />}
            onClick={() => {
              window.open(url, "_blank", "noopener");
              close();
            }}
          >
            Open in browser
          </MenuItem>
          {lead.phone && (
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              onClick={() => {
                void copy(lead.phone as string, "Number copied");
                close();
              }}
            >
              Copy number {lead.phone}
            </MenuItem>
          )}
        </>
      )}
    </Dropdown>
  );
}

export function ResearchMenu({ lead, size = "sm" }: { lead: Lead; size?: "sm" | "md" }) {
  const website = ensureUrl(lead.website);
  const maps = mapsHref(lead);
  return (
    <Dropdown
      trigger={({ toggle }) => (
        <ActionBtn
          size={size}
          icon={<Search className="h-3.5 w-3.5" />}
          label="Research"
          onClick={(e) => {
            e.preventDefault();
            toggle();
          }}
        />
      )}
      panelClassName="w-60"
    >
      {({ close }) => (
        <>
          <MenuLabel>Research</MenuLabel>
          <MenuItem
            icon={<Search className="h-4 w-4" />}
            onClick={() => {
              window.open(googleSearchUrl(lead), "_blank", "noopener");
              close();
            }}
          >
            Google search
          </MenuItem>
          <MenuItem
            icon={<ImageIcon className="h-4 w-4" />}
            onClick={() => {
              window.open(googleImagesUrl(lead), "_blank", "noopener");
              close();
            }}
          >
            Google images
          </MenuItem>
          {maps && (
            <MenuItem
              icon={<MapPin className="h-4 w-4" />}
              onClick={() => {
                window.open(maps, "_blank", "noopener");
                close();
              }}
            >
              Google Maps
            </MenuItem>
          )}
          {website && (
            <MenuItem
              icon={<Globe className="h-4 w-4" />}
              onClick={() => {
                window.open(website, "_blank", "noopener");
                close();
              }}
            >
              Website
            </MenuItem>
          )}
          {(
            [
              ["Facebook", lead.facebook, Facebook],
              ["Instagram", lead.instagram, Instagram],
              ["TikTok", lead.tiktok, Music2],
              ["LinkedIn", lead.linkedin, Linkedin],
            ] as const
          ).map(([label, value, Icon]) => {
            const url = socialUrl(label.toLowerCase() as "facebook", value);
            if (!url) return null;
            return (
              <MenuItem
                key={label}
                icon={<Icon className="h-4 w-4" />}
                onClick={() => {
                  window.open(url, "_blank", "noopener");
                  close();
                }}
              >
                {label}
              </MenuItem>
            );
          })}
        </>
      )}
    </Dropdown>
  );
}

export function MessageMenu({ lead, size = "sm" }: { lead: Lead; size?: "sm" | "md" }) {
  const wa = whatsappHref(lead.phone);
  const tg = socialUrl("telegram", lead.telegram) ?? telegramHref(lead.phone);
  if (!wa && !tg) return null;
  return (
    <Dropdown
      trigger={({ toggle }) => (
        <ActionBtn
          size={size}
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          label="Message"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }}
        />
      )}
      panelClassName="w-52"
    >
      {({ close }) => (
        <>
          <MenuLabel>Message</MenuLabel>
          {wa && (
            <MenuItem
              icon={<MessageCircle className="h-4 w-4" />}
              onClick={() => {
                window.open(wa, "_blank", "noopener");
                close();
              }}
            >
              WhatsApp
            </MenuItem>
          )}
          {tg && (
            <MenuItem
              icon={<Send className="h-4 w-4" />}
              onClick={() => {
                window.open(tg, "_blank", "noopener");
                close();
              }}
            >
              Telegram
            </MenuItem>
          )}
        </>
      )}
    </Dropdown>
  );
}

/** Stable deep link to a lead inside the app. */
export function crmLeadUrl(leadId: number): string {
  if (typeof window === "undefined") return `/leads/${leadId}`;
  return `${window.location.origin}/leads/${leadId}`;
}

export function CopyMenu({ lead, size = "sm" }: { lead: Lead; size?: "sm" | "md" }) {
  const copy = useCopy();
  const [briefOpen, setBriefOpen] = useState(false);
  return (
    <>
      <Dropdown
        trigger={({ toggle }) => (
          <ActionBtn
            size={size}
            icon={<Copy className="h-3.5 w-3.5" />}
            label="Copy"
            onClick={(e) => {
              e.preventDefault();
              toggle();
            }}
          />
        )}
        panelClassName="w-56"
      >
        {({ close }) => (
          <>
            <MenuLabel>Copy</MenuLabel>
            {lead.phone && (
              <MenuItem
                icon={<Phone className="h-4 w-4" />}
                onClick={() => {
                  void copy(lead.phone as string, "Phone copied");
                  close();
                }}
              >
                Copy phone
              </MenuItem>
            )}
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              onClick={() => {
                void copy(buildLeadInfoText(lead), "All info copied");
                close();
              }}
            >
              Copy all info
            </MenuItem>
            <MenuItem
              icon={<Sparkles className="h-4 w-4" />}
              onClick={() => {
                close();
                setBriefOpen(true);
              }}
            >
              Copy website brief…
            </MenuItem>
            <MenuItem
              icon={<LinkIcon className="h-4 w-4" />}
              onClick={() => {
                void copy(crmLeadUrl(lead.id), "CRM link copied");
                close();
              }}
            >
              Copy CRM link
            </MenuItem>
          </>
        )}
      </Dropdown>
      <WebsiteBriefDialog open={briefOpen} onClose={() => setBriefOpen(false)} lead={lead} />
    </>
  );
}

export function SocialIcons({ lead, className }: { lead: Lead; className?: string }) {
  const items = [
    { url: socialUrl("facebook", lead.facebook), icon: Facebook, label: "Facebook" },
    { url: socialUrl("instagram", lead.instagram), icon: Instagram, label: "Instagram" },
    { url: socialUrl("tiktok", lead.tiktok), icon: Music2, label: "TikTok" },
    { url: socialUrl("linkedin", lead.linkedin), icon: Linkedin, label: "LinkedIn" },
    { url: socialUrl("telegram", lead.telegram) ?? telegramHref(lead.phone), icon: Send, label: "Telegram" },
  ].filter((i) => i.url);

  if (!items.length) return null;
  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      {items.map((i) => (
        <a
          key={i.label}
          href={i.url as string}
          target="_blank"
          rel="noreferrer noopener"
          title={i.label}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md p-1.5 text-subtle transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <i.icon className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  );
}

export interface QuickActionsProps {
  lead: Lead;
  size?: "sm" | "md";
  /** Desktop default: grouped Message / Research / Copy. */
  show?: Array<"call" | "message" | "wa" | "tg" | "maps" | "web" | "research" | "copy" | "archive" | "share" | "more">;
  /** Force the large call button (Call Mode / mobile). */
  phoneMode?: boolean;
  /** Lets the parent list update its cached row after an inline edit. */
  onChange?: (lead: Lead, patch: Partial<Lead>) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
  className?: string;
}

export function QuickActions({
  lead,
  size = "sm",
  show = ["message", "research", "copy"],
  phoneMode = false,
  onChange,
  onEdit,
  onDelete,
  onOpen,
  className,
}: QuickActionsProps) {
  const copy = useCopy();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const showCall = phoneMode || show.includes("call");
  const bigCall = phoneMode;
  const has = (k: string) => show.includes(k as never);
  const website = ensureUrl(lead.website);
  const maps = mapsHref(lead);
  const tel = telHref(lead.phone);

  const share = async () => {
    const text = buildLeadInfoText(lead);
    try {
      if (navigator.share) {
        await navigator.share({ title: lead.businessName, text });
        return;
      }
    } catch {
      /* user cancelled */
    }
    void copy(text, "Copied for sharing");
  };

  const toggleArchive = async () => {
    const patch = { archived: !lead.archived };
    try {
      const result = await apiPatch<{ lead: Lead }>(`/api/leads/${lead.id}`, patch);
      onChange?.(lead, result?.lead ?? patch);
      toast(lead.archived ? "Restored from archive" : "Archived", "success");
    } catch (error) {
      toast((error as Error).message || "Could not update", "error");
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      {showCall && tel && (
        <a href={tel} onClick={(e) => e.stopPropagation()} className={bigCall ? "flex-1" : ""}>
          {bigCall ? (
            <Button variant="primary" className="h-12 w-full gap-2 rounded-xl text-[15px] font-semibold">
              <Phone className="h-5 w-5" /> Call
            </Button>
          ) : (
            <ActionBtn size={size} icon={<Phone className="h-3.5 w-3.5" />} label="Call" />
          )}
        </a>
      )}
      {(has("message") || has("wa") || has("tg")) && <MessageMenu lead={lead} size={size} />}
      {!has("message") && has("tg") && <TelegramButton lead={lead} size={size} />}
      {has("maps") && maps && (
        <a href={maps} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
          <ActionBtn size={size} icon={<MapPin className="h-3.5 w-3.5" />} label="Maps" />
        </a>
      )}
      {has("web") && website && (
        <a href={website} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
          <ActionBtn size={size} icon={<Globe className="h-3.5 w-3.5" />} label="Website" />
        </a>
      )}
      {has("research") && <ResearchMenu lead={lead} size={size} />}
      {has("copy") && <CopyMenu lead={lead} size={size} />}
      {has("archive") && (
        <ActionBtn
          size={size}
          icon={lead.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          label={lead.archived ? "Restore" : "Archive"}
          onClick={toggleArchive}
        />
      )}
      {has("share") && (
        <ActionBtn size={size} icon={<Share2 className="h-3.5 w-3.5" />} label="Share" onClick={share} />
      )}
      {has("more") && (
        <Dropdown
          trigger={({ toggle }) => (
            <ActionBtn
              size={size}
              icon={<MoreHorizontal className="h-3.5 w-3.5" />}
              label="More"
              onClick={(e) => {
                e.preventDefault();
                toggle();
              }}
            />
          )}
        >
          {({ close }) => (
            <>
              <MenuItem
                icon={copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                onClick={async () => {
                  await copy(crmLeadUrl(lead.id), "CRM link copied");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                  close();
                }}
              >
                Copy CRM link
              </MenuItem>
              {onOpen && (
                <MenuItem
                  icon={<ExternalLink className="h-4 w-4" />}
                  onClick={() => {
                    onOpen();
                    close();
                  }}
                >
                  Open profile
                </MenuItem>
              )}
              {onEdit && (
                <MenuItem
                  icon={<Search className="h-4 w-4" />}
                  onClick={() => {
                    onEdit();
                    close();
                  }}
                >
                  Edit lead
                </MenuItem>
              )}
              {onDelete && (
                <MenuItem
                  danger
                  icon={<Archive className="h-4 w-4" />}
                  onClick={() => {
                    onDelete();
                    close();
                  }}
                >
                  Delete lead
                </MenuItem>
              )}
            </>
          )}
        </Dropdown>
      )}
    </div>
  );
}
