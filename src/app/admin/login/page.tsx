import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import LoginFrame from "@/components/login/LoginFrame";
import AdminLogin from "@/components/login/AdminLogin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrator sign in",
};

export default async function AdminLoginPage() {
  const user = await getServerUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");
  return (
    <LoginFrame>
      <AdminLogin />
    </LoginFrame>
  );
}
