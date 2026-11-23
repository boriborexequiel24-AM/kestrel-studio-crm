import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return <ComingSoon title="Pipeline" />;
}
