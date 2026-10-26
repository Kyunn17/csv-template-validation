import { Suspense } from "react";
import { connection } from "next/server";
import UploadForm from "@/components/UploadForm";
import { getPublicTemplates } from "@/lib/templates";

async function Content() {
  await connection();
  return <UploadForm templates={await getPublicTemplates()} />;
}

export default function Home() {
  return (
    <Suspense fallback={<main className="loading-screen"><span className="spinner" />Memuat...</main>}>
      <Content />
    </Suspense>
  );
}