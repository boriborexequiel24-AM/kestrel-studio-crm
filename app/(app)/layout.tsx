import { TopBar } from "@/components/app/top-bar";

// The app frame for every signed-in screen. Each screen checks for a live
// Sandbox itself (requireLiveSandbox) inside its own Suspense boundary.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main tabIndex={-1} className="outline-none mx-auto max-w-[1440px] px-4 pt-6 pb-16 md:px-6">{children}</main>
    </div>
  );
}
