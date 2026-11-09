import { BrandMark, Logo } from "@/components/Logo";
import { Radio, ShieldCheck, TrainFront, UserRoundCheck } from "lucide-react";

export default function LoginFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-slate-100 lg:flex-row">
      <section className="surface-navy relative flex flex-col justify-between overflow-hidden px-6 py-8 text-white sm:px-10 lg:w-[46%] lg:py-12">
        <div className="relative z-10">
          <BrandMark light />
          <div className="mt-10 max-w-md lg:mt-20">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-metro-yellow">
              <TrainFront className="h-3.5 w-3.5" /> Pink Line · Station Coordination
            </div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl lg:text-[2.75rem]">
              Coordinated assistance for every Divyangjan journey.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
              Real-time station hand-offs, three-station arrival alarms and manual train tracking — built as a
              controlled prototype for Delhi Metro Pink Line stations.
            </p>
          </div>

          <ul className="mt-8 hidden max-w-md grid-cols-1 gap-3 text-sm sm:grid lg:mt-10 lg:grid-cols-2">
            {[
              { icon: <Radio className="h-4 w-4" />, text: "Live station notifications" },
              { icon: <UserRoundCheck className="h-4 w-4" />, text: "Destination acknowledgement" },
              { icon: <TrainFront className="h-4 w-4" />, text: "Manual train movement" },
              { icon: <ShieldCheck className="h-4 w-4" />, text: "Station-scoped access" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <span className="text-metro-yellow">{item.icon}</span>
                <span className="text-white/85">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 mt-10 hidden items-center gap-4 lg:flex">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
            <Logo className="h-14 w-14" />
          </div>
          <div className="text-xs leading-relaxed text-white/50">
            Independent prototype. Not connected to DMRC internal systems.
            <br />
            Do not use real passenger data without authorization.
          </div>
        </div>

        <div className="pointer-events-none absolute -right-24 top-14 hidden h-72 w-72 rounded-full border-[28px] border-white/5 lg:block" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full border-[28px] border-metro-yellow/10" />
      </section>

      <section className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
