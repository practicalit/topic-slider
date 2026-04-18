/** Avoid stale cached RSC for /login (e.g. after deploys); pairs with full navigation on sign-out. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
