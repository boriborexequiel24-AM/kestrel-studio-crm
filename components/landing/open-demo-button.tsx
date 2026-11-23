"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OpenDemoButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-12 rounded-lg px-6 text-[16px] font-semibold transition-colors duration-150 hover:bg-primary-hover">
      {pending ? "Opening your Sandbox..." : "Open the demo"}
      {!pending && <ArrowRight className="size-5" aria-hidden />}
    </Button>
  );
}
