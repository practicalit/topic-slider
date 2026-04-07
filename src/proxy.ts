export { auth as proxy } from "@/lib/auth";

export const config = {
  matcher: [
    "/admin/:path*",
    "/context/:path*",
    "/super/:path*",
    "/present/:path*",
    "/quiz/:path*",
    "/leaderboard/:path*",
    "/students/:path*",
    "/api/topics/:path*",
    "/api/students/:path*",
    "/api/me/:path*",
    "/api/super/:path*",
    "/api/quiz/:path*",
    "/api/stars/:path*",
    "/api/uploads/:path*",
    "/api/admin/:path*",
  ],
};
