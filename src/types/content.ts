export type ContentKind = "TEXT" | "SLIDE" | "IMAGE" | "VIDEO";

export const CONTENT_KIND_OPTIONS: { value: ContentKind; label: string; hint: string }[] = [
  { value: "TEXT", label: "Text", hint: "Title + markdown body (paragraphs, lists, etc.)" },
  { value: "SLIDE", label: "Slide", hint: "Large title with supporting markdown below (presentation style)" },
  {
    value: "IMAGE",
    label: "Picture",
    hint: "https:// image URL or upload JPEG / PNG / GIF / WebP",
  },
  {
    value: "VIDEO",
    label: "Video",
    hint: "YouTube, Vimeo, link, or upload MP4 / WebM / Ogg",
  },
];
