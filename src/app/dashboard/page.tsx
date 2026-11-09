import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import StationApp from "@/components/station/StationApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Station dashboard",
};

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");
  if (user.stationId == null || !user.stationName) redirect("/login");
  return <StationApp user={user} />;
}
