import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import TemplateForm from "@/components/TemplateForm";
import { getTemplate } from "@/lib/templates";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const template =await getTemplate(id);
  if (!template) notFound();
  return <TemplateForm mode="edit" initial={template} />;
}

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="loading-screen"><span className="spinner" />Memuat...</main>}>
      <Content params={params} />
    </Suspense>
  );
}