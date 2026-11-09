import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import LoginFrame from "@/components/login/LoginFrame";
import StationLogin from "@/components/login/StationLogin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Station sign in",
};

export default async function LoginPage() {
  const user = await getServerUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");
  return (
    <LoginFrame>
      <StationLogin />
    </LoginFrame>
  );
}
