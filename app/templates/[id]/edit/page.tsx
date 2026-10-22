import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import TemplateForm from "@/components/TemplateForm";
import { getTemplate } from "@/lib/templates";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const template = getTemplate(id);
  if (!template) notFound();
  return <TemplateForm mode="edit" initial={template} />;
}

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="p-10 text-center text-sm text-gray-500">Memuat...</main>}>
      <Content params={params} />
    </Suspense>
  );
}