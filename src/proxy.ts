export { auth as proxy } from "@/lib/auth";

export const config = {
  matcher: [
    "/admin/:path*",
    "/present/:path*",
    "/quiz/:path*",
    "/leaderboard/:path*",
    "/api/topics/:path*",
    "/api/students/:path*",
    "/api/quiz/:path*",
    "/api/stars/:path*",
  ],
};
