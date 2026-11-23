import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return <ComingSoon title="Home" />;
}
