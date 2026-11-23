import type { Metadata } from "next";
import { Suspense } from "react";
import { PipelineView } from "@/components/pipeline/pipeline-view";

export const metadata: Metadata = { title: "Deal" };

// A Deal has its own link, and opens in a Sheet over the Pipeline.
export default function DealPage({ params, searchParams }: PageProps<"/deals/[id]">) {
  return (
    <Suspense>
      <DealRoute params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DealRoute({ params, searchParams }: Pick<PageProps<"/deals/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  return <PipelineView searchParams={searchParams} openDealId={id} />;
}
