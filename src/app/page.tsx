import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth();
  redirect(session ? "/dashboard" : "/login");
}
