import UploadForm from "@/components/UploadForm";
import { getPublicTemplates } from "@/lib/templates";

export default function Home() {
  return <UploadForm templates={getPublicTemplates()} />;
}