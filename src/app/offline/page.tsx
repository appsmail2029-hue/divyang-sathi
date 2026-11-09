import Link from "next/link";
import { BrandMark } from "@/components/Logo";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="surface-navy flex min-h-dvh flex-col items-center justify-center px-6 text-center text-white">
      <BrandMark light />
      <div className="mt-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
        <WifiOff className="h-8 w-8 text-metro-yellow" />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold">You are offline</h1>
      <p className="mt-2 max-w-sm text-sm text-white/70">
        Metro Assist needs a network connection for live station coordination. Check your connection and try again.
      </p>
      <Link href="/dashboard" className="btn-yellow btn-lg mt-6">
        Retry
      </Link>
    </main>
  );
}
