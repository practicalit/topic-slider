import type { CSSProperties } from "react";
import type { Prisma } from "@prisma/client";

export type SlideFontId = "sans" | "serif" | "rounded" | "mono";

/** Versioned shape stored in Content.slideTheme (SLIDE kind only). */
export type SlideThemeV1 = {
  v: 1;
  titleFont: SlideFontId;
  titleColor: string;
  titleSizePx: number;
  bodyFont: SlideFontId;
  bodyColor: string;
  bodySizePx: number;
  /** Preset key or hex background for the slide canvas */
  pageBg: string;
  cardBg: string;
  cardBorder: string;
};

export const SLIDE_FONT_OPTIONS: { id: SlideFontId; label: string }[] = [
  { id: "sans", label: "Sans (clean)" },
  { id: "serif", label: "Serif (classic)" },
  { id: "rounded", label: "Rounded / friendly" },
  { id: "mono", label: "Monospace" },
];

export const SLIDE_PAGE_BG_PRESETS: { id: string; label: string; css: string }[] = [
  { id: "transparent", label: "Default (page background)", css: "transparent" },
  { id: "white", label: "White", css: "#ffffff" },
  { id: "cream", label: "Cream", css: "#faf7ef" },
  { id: "parchment", label: "Parchment", css: "#f0ebe0" },
  { id: "mint", label: "Soft mint gradient", css: "linear-gradient(145deg, #ecfdf5 0%, #f0fdf4 45%, #fefce8 100%)" },
  { id: "gold", label: "Soft gold gradient", css: "linear-gradient(175deg, #fef9c3 0%, #fffbeb 55%, #faf7ef 100%)" },
  { id: "sky", label: "Sky mist", css: "linear-gradient(160deg, #e0f2fe 0%, #f0f9ff 50%, #faf7ef 100%)" },
];

const FONT_CSS: Record<SlideFontId, string> = {
  sans: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  rounded: '"Trebuchet MS", "Lucida Grande", "Segoe UI", sans-serif',
  mono: 'ui-monospace, "Cascadia Code", "Source Code Pro", monospace',
};

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isHex(s: string): boolean {
  return HEX_RE.test(s.trim());
}

export function pageBgToCss(pageBg: string): string {
  const preset = SLIDE_PAGE_BG_PRESETS.find((p) => p.id === pageBg);
  if (preset) return preset.css;
  if (isHex(pageBg)) return pageBg.trim();
  return "transparent";
}

export const DEFAULT_SLIDE_THEME_V1: SlideThemeV1 = {
  v: 1,
  titleFont: "serif",
  titleColor: "#0a2918",
  titleSizePx: 44,
  bodyFont: "sans",
  bodyColor: "#1e3a2f",
  bodySizePx: 18,
  pageBg: "mint",
  cardBg: "#ffffff",
  cardBorder: "#d4c4a8",
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseFont(v: unknown): SlideFontId {
  if (v === "sans" || v === "serif" || v === "rounded" || v === "mono") return v;
  return "sans";
}

/** Accept partial / unknown JSON from DB or API; merge with defaults. Returns null if input is null/undefined (legacy slide). */
export function parseSlideThemeFromDb(raw: unknown): SlideThemeV1 | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const pageBg =
    typeof o.pageBg === "string" && (SLIDE_PAGE_BG_PRESETS.some((p) => p.id === o.pageBg) || isHex(o.pageBg))
      ? o.pageBg
      : DEFAULT_SLIDE_THEME_V1.pageBg;

  const cardBg = typeof o.cardBg === "string" && isHex(o.cardBg) ? o.cardBg.trim() : DEFAULT_SLIDE_THEME_V1.cardBg;
  const cardBorder =
    typeof o.cardBorder === "string" && isHex(o.cardBorder)
      ? o.cardBorder.trim()
      : DEFAULT_SLIDE_THEME_V1.cardBorder;

  return {
    v: 1,
    titleFont: parseFont(o.titleFont),
    titleColor: typeof o.titleColor === "string" && isHex(o.titleColor) ? o.titleColor.trim() : DEFAULT_SLIDE_THEME_V1.titleColor,
    titleSizePx: clamp(typeof o.titleSizePx === "number" ? o.titleSizePx : Number(o.titleSizePx), 28, 64),
    bodyFont: parseFont(o.bodyFont),
    bodyColor: typeof o.bodyColor === "string" && isHex(o.bodyColor) ? o.bodyColor.trim() : DEFAULT_SLIDE_THEME_V1.bodyColor,
    bodySizePx: clamp(typeof o.bodySizePx === "number" ? o.bodySizePx : Number(o.bodySizePx), 14, 26),
    pageBg,
    cardBg,
    cardBorder,
  };
}

export function slideThemeToPrismaJson(theme: SlideThemeV1): Prisma.InputJsonValue {
  return { ...theme } as unknown as Prisma.InputJsonValue;
}

export function fontCss(id: SlideFontId): string {
  return FONT_CSS[id] ?? FONT_CSS.sans;
}

export function slideThemeTitleStyle(theme: SlideThemeV1): CSSProperties {
  return {
    fontFamily: fontCss(theme.titleFont),
    color: theme.titleColor,
    fontSize: theme.titleSizePx,
    lineHeight: 1.15,
    fontWeight: 700,
  };
}

export function slideThemeBodyWrapperStyle(theme: SlideThemeV1): CSSProperties {
  return {
    fontFamily: fontCss(theme.bodyFont),
    color: theme.bodyColor,
    fontSize: theme.bodySizePx,
    lineHeight: 1.65,
    ["--slide-prose-body" as string]: theme.bodyColor,
    ["--slide-prose-heading" as string]: theme.titleColor,
    ["--slide-prose-link" as string]: "#14532d",
  };
}

