import { Suspense } from "react";
import { connection } from "next/server";
import TemplateList from "@/components/TemplateList";
import { loadAll } from "@/lib/templates";

async function Content() {
  await connection();
  const { templates, problems } = await loadAll();
  return <TemplateList templates={templates} problems={problems} />;
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<main className="loading-screen"><span className="spinner" />Memuat...</main>}>
      <Content />
    </Suspense>
  );
}