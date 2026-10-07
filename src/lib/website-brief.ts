import type { Lead } from "./types";
import { ensureUrl, mapsHref, normalizePhone, socialUrl, telegramHref } from "./utils";

export const WEBSITE_BRIEF_SETTING_KEY = "websiteBrief";

/** Placeholders available in the template. Use {{key}} syntax. */
export const BRIEF_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "business_name", label: "Business name" },
  { key: "category", label: "Category" },
  { key: "city", label: "City" },
  { key: "address", label: "Address" },
  { key: "location", label: "City + address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "telegram", label: "Telegram @ or phone" },
  { key: "google_maps_url", label: "Google Maps URL" },
  { key: "website", label: "Existing website or none" },
  { key: "rating", label: "Rating" },
  { key: "reviews_count", label: "Review count" },
  { key: "rating_line", label: "Rating · N reviews" },
  { key: "facebook_url", label: "Facebook" },
  { key: "instagram_url", label: "Instagram" },
  { key: "tiktok_url", label: "TikTok" },
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "notes", label: "CRM notes" },
  { key: "missing_fields", label: "List of empty critical fields" },
];

export const DEFAULT_WEBSITE_BRIEF_TEMPLATE = `You are a senior product designer + frontend engineer. Build ONE production-ready marketing website for a real Ethiopian business (not for an agency homepage).

## Business (facts from CRM — research Maps before designing)
- Business name: {{business_name}}
- Category / what they sell: {{category}}
- City / area: {{location}}
- Phone (WhatsApp-ready): {{phone}}
- Telegram: {{telegram}}
- Email: {{email}}
- Google Maps URL: {{google_maps_url}}
- Existing website: {{website}}
- Google rating: {{rating_line}}
- Facebook: {{facebook_url}}
- Instagram: {{instagram_url}}
- TikTok: {{tiktok_url}}
- LinkedIn: {{linkedin_url}}
- CRM notes: {{notes}}

Missing critical data (fill or research if listed): {{missing_fields}}

## Goal
- Make the business look professional and trustworthy
- Drive contact via Call, WhatsApp, and Telegram
- Full UI in English + Amharic (toggle, persist choice; default English)
- Embed Google Maps from the URL above; show written address in EN + Amharic

## Mandatory research before design
1. Open the Google Maps URL. Extract exact name, address, rating, review count, category, hours if shown.
2. Use REAL photos from the public web (Unsplash/Pexels/Wikimedia or similar) that fit this type of Ethiopian business. Do NOT use AI-generated images.
3. Write copy from facts, not generic filler.

## Site structure (single page)
1. Sticky header: name/logo, nav, EN | አማ toggle, Call + WhatsApp CTAs
2. Hero: strong local visual, clear headline, value line, Call / WhatsApp / Telegram, trust line (rating, location)
3. About / what they offer
4. Services or offerings (cards)
5. Location: map embed + address
6. Social proof from rating/reviews if available
7. FAQ (4–6 local questions)
8. Final CTA: Call / WhatsApp / Telegram
9. Footer: name, phone, Telegram, address

## Design rules
- Clean, calm, high contrast, mobile-first
- Avoid: purple glassmorphism everywhere, fake 3D, stock “laptop people”, excessive gradients, robot English
- Prefer: neutral palette, one accent, solid buttons, real hierarchy
- Subtle scroll motion only
- WhatsApp: https://wa.me/ with digits only from phone
- Telegram: https://t.me/username or phone-based link
- tel: links for call

## Tech
- Single page ready to deploy (HTML/CSS/JS or simple React/Vite)
- No backend; fast load; lazy images; accessible lang switching

## Output
- Complete production-ready code
- Short note: Maps facts used + image sources
`;

function val(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  return text || "—";
}

export function leadToBriefVars(lead: Lead): Record<string, string> {
  const location = [lead.city, lead.address].filter((x) => (x ?? "").trim()).join(", ") || "—";
  const telegram = (lead.telegram ?? "").trim() || (lead.phone ?? "").trim() || "—";
  const website = ensureUrl(lead.website) ?? "none";
  const rating = lead.rating != null ? String(lead.rating) : "—";
  const reviews = lead.reviewCount != null ? String(lead.reviewCount) : "—";
  const ratingLine =
    lead.rating != null ? `${lead.rating}${lead.reviewCount != null ? ` · ${lead.reviewCount} reviews` : ""}` : "—";

  const missing: string[] = [];
  if (!(lead.businessName ?? "").trim()) missing.push("business_name");
  if (!mapsHref(lead)) missing.push("google_maps_url");
  if (!(lead.phone ?? "").trim()) missing.push("phone");
  if (!(lead.category ?? "").trim()) missing.push("category");
  if (!(lead.city ?? lead.address ?? "").trim()) missing.push("location");

  return {
    business_name: val(lead.businessName),
    category: val(lead.category),
    city: val(lead.city),
    address: val(lead.address),
    location,
    phone: normalizePhone(lead.phone) ?? val(lead.phone),
    email: val(lead.email),
    telegram,
    google_maps_url: val(mapsHref(lead)),
    website,
    rating,
    reviews_count: reviews,
    rating_line: ratingLine,
    facebook_url: val(socialUrl("facebook", lead.facebook)),
    instagram_url: val(socialUrl("instagram", lead.instagram)),
    tiktok_url: val(socialUrl("tiktok", lead.tiktok)),
    linkedin_url: val(socialUrl("linkedin", lead.linkedin)),
    notes: val(lead.notes),
    missing_fields: missing.length ? missing.join(", ") : "none",
  };
}

export function fillWebsiteBrief(template: string, lead: Lead): string {
  const vars = leadToBriefVars(lead);
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    const value = vars[key.toLowerCase()];
    return value != null ? value : `{{${key}}}`;
  });
}

export function missingBriefFields(lead: Lead): string[] {
  const vars = leadToBriefVars(lead);
  return vars.missing_fields === "none" ? [] : vars.missing_fields.split(", ").filter(Boolean);
}

export function isWebsiteBriefUrl(platform: "facebook" | "instagram" | "tiktok" | "telegram" | "linkedin", value: string | null) {
  return socialUrl(platform, value);
}

export { telegramHref };
