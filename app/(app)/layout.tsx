import { TimeZoneSync } from "@/components/app/time-zone-sync";
import { TopBar } from "@/components/app/top-bar";

// The app frame for every signed-in screen. Each screen checks for a live
// Sandbox itself (requireLiveSandbox) inside its own Suspense boundary.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <TimeZoneSync />
      <TopBar />
      <main className="mx-auto max-w-[1440px] px-4 pt-6 pb-16 md:px-6">{children}</main>
    </div>
  );
}
