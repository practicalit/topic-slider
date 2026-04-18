import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mahibere Kidusan Educator",
    short_name: "MK Educator",
    description:
      "Classroom presentation and quiz tool for substitute teachers and volunteers — topics, slides, quizzes, and stars.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser", "minimal-ui"],
    orientation: "any",
    background_color: "#f9fafb",
    theme_color: "#4f46e5",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/api/pwa-icon?s=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?s=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?s=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Present",
        short_name: "Present",
        description: "Open presentation mode",
        url: "/present",
      },
      {
        name: "Sign in",
        short_name: "Login",
        url: "/login",
      },
    ],
  };
}
