import { Suspense } from "react";
import { LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/app/logo";
import { DemoEntry } from "@/components/landing/demo-entry";
import { OpenDemoForm } from "@/components/landing/open-demo-form";

const POINTS = [
  {
    icon: LockKeyhole,
    title: "Your own private Sandbox",
    text: "A full copy of the agency's sample data. Change anything; nobody else sees it.",
  },
  {
    icon: Sparkles,
    title: "AI built in",
    text: "Summarize a client, draft a follow-up, or ask the pipeline a question.",
  },
  {
    icon: RotateCcw,
    title: "Resets in 24 hours",
    text: "Your Sandbox clears itself after a day, so you can't break anything.",
  },
];

export default function LandingPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-12 md:py-20">
      <div className="flex-1">
        <LogoMark className="size-12" />
        <h1 className="mt-6 text-[36px] leading-tight font-bold tracking-tight md:text-[44px]">Kestrel Studio CRM</h1>
        <p className="mt-3 max-w-2xl text-[18px] text-muted-foreground">
          The internal CRM of a 12-person brand and performance agency, with AI built in. Click around as Maya, the
          Account Director.
        </p>

        <ul className="mt-10 grid gap-3 md:grid-cols-3">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="size-5 text-primary" aria-hidden />
              <h2 className="mt-3 text-[15px] font-bold">{title}</h2>
              <p className="mt-1 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Suspense fallback={<OpenDemoForm />}>
            <DemoEntry searchParams={searchParams} />
          </Suspense>
        </div>
      </div>

      <footer className="mt-16 text-[13px] text-muted-foreground">
        <a
          href="https://workwithzeki.vercel.app"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 transition-colors duration-150 hover:text-primary-hover hover:underline"
        >
          Built by Zeki
        </a>
      </footer>
    </main>
  );
}
