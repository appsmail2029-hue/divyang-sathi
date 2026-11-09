import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}
