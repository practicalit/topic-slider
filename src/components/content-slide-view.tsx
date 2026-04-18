"use client";

import ReactMarkdown from "react-markdown";
import { resolveVideoEmbed } from "@/lib/video-embed";
import {
  pageBgToCss,
  slideThemeBodyWrapperStyle,
  slideThemeTitleStyle,
  type SlideThemeV1,
} from "@/lib/slide-theme";

export type ContentBlock = {
  kind: "TEXT" | "SLIDE" | "IMAGE" | "VIDEO";
  title: string;
  body: string;
  /** Parsed SLIDE theme; null/undefined = site default layout */
  slideTheme?: SlideThemeV1 | null;
};

const mdComponents = {
  img: ({ ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element -- user markdown may point to any HTTPS URL
    <img
      {...props}
      className="rounded-xl mx-auto max-h-[min(50dvh,55vh,32rem)] w-auto object-contain"
      alt={props.alt ?? ""}
    />
  ),
};

const SLIDE_MD_SPACING =
  "max-w-none text-left mx-auto leading-relaxed prose-p:my-4 prose-headings:mt-8 prose-headings:mb-4 prose-li:my-1.5 prose-blockquote:my-5 prose-ul:my-4 prose-ol:my-4 prose-table:my-6 prose-hr:my-6 max-w-[min(100%,52rem)] 2xl:max-w-[min(100%,64rem)]";
/* Fluid prose: phones → TVs (override Tailwind prose-lg fixed size) */
const slideProseThemed = `prose prose-lg max-[480px]:prose-base xl:prose-xl 2xl:prose-2xl slide-themed-prose ${SLIDE_MD_SPACING}`;
const slideProseDefault = `prose prose-lg max-[480px]:prose-base xl:prose-xl 2xl:prose-2xl text-gray-800 ${SLIDE_MD_SPACING}`;

export function ContentSlideView({ content }: { content: ContentBlock }) {
  const { kind, title, body, slideTheme } = content;

  if (kind === "IMAGE") {
    return (
      <div className="space-y-6">
        <h2 className="text-[clamp(1.25rem,3.5vw,2.75rem)] md:text-[clamp(1.35rem,3vw,3rem)] font-bold text-gray-900 text-center px-1">
          {title}
        </h2>
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={body}
            alt={title}
            className="max-w-full max-h-[min(65dvh,70vh,56rem)] w-auto rounded-2xl object-contain border border-gray-200 shadow-lg"
          />
        </div>
      </div>
    );
  }

  if (kind === "VIDEO") {
    return (
      <div className="space-y-6">
        <h2 className="text-[clamp(1.25rem,3.5vw,2.75rem)] md:text-[clamp(1.35rem,3vw,3rem)] font-bold text-gray-900 text-center px-1">
          {title}
        </h2>
        <VideoEmbedBlock url={body} label={title} />
      </div>
    );
  }

  if (kind === "SLIDE") {
    const theme = slideTheme ?? null;
    if (theme) {
      return (
        <div
          className="rounded-2xl p-3 sm:p-5 -mx-0 sm:-mx-1"
          style={{ background: pageBgToCss(theme.pageBg) }}
        >
          <div
            className="space-y-8 text-center rounded-xl border-2 px-5 py-8 md:px-10 md:py-10 shadow-md"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
            }}
          >
            <h2 className="text-center tracking-tight" style={slideThemeTitleStyle(theme)}>
              {title}
            </h2>
            <div className={slideProseThemed} style={slideThemeBodyWrapperStyle(theme)}>
              <ReactMarkdown components={mdComponents}>{body}</ReactMarkdown>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight tracking-tight">
          {title}
        </h2>
        <div className={slideProseDefault}>
          <ReactMarkdown components={mdComponents}>{body}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">{title}</h2>
      <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed prose-p:my-4 prose-headings:mt-8 prose-headings:mb-4 prose-li:my-1.5 prose-blockquote:my-5 prose-ul:my-4 prose-ol:my-4 prose-table:my-6 prose-hr:my-6">
        <ReactMarkdown components={mdComponents}>{body}</ReactMarkdown>
      </div>
    </>
  );
}

function VideoEmbedBlock({ url, label }: { url: string; label: string }) {
  const r = resolveVideoEmbed(url);

  if (r.kind === "youtube") {
    return (
      <div className="aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden border border-gray-200 shadow-lg bg-black">
        <iframe
          title={label}
          src={`https://www.youtube-nocookie.com/embed/${r.id}?rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  if (r.kind === "vimeo") {
    return (
      <div className="aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden border border-gray-200 shadow-lg bg-black">
        <iframe
          title={label}
          src={`https://player.vimeo.com/video/${r.id}`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  if (r.kind === "dailymotion") {
    return (
      <div className="aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden border border-gray-200 shadow-lg bg-black">
        <iframe
          title={label}
          src={`https://www.dailymotion.com/embed/video/${r.id}`}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  if (r.kind === "native") {
    return (
      <div className="max-w-4xl mx-auto rounded-xl overflow-hidden border border-gray-200 shadow-lg bg-black">
        <video src={r.src} controls className="w-full max-h-[70vh]" playsInline />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto rounded-xl border-2 border-dashed border-indigo-300 bg-gray-100 p-8 text-center">
      <p className="text-gray-800 mb-4">
        This link is not a supported embed (YouTube, Vimeo, Dailymotion, or direct .mp4/.webm). Open it in
        a new tab to play.
      </p>
      <a
        href={r.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg border border-indigo-200 hover:bg-indigo-700 transition-colors"
      >
        Open video ↗
      </a>
      <p className="text-xs text-gray-500 mt-3 break-all">{r.href}</p>
    </div>
  );
}
