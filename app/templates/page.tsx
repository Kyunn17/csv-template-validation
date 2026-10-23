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
    <Suspense fallback={<main className="p-10 text-center text-sm text-gray-500">Memuat...</main>}>
      <Content />
    </Suspense>
  );
}