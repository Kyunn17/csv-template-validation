import UploadForm from "../components/UploadForm";
import { templates } from "@/lib/templates";

export default function Home() {
  const options = Object.values(templates).map((t) => ({
    id: t.id,
    label: t.label,
  }));

  return <UploadForm options={options} />;
}