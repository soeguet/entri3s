import { PageHeader } from "../../components/PageHeader";
import { TagsSection } from "./TagsSection";
import { TemplatesSection } from "./TemplatesSection";

export function ManagementPage() {
  return (
    <div>
      <PageHeader title="Management" description="Tags und Templates verwalten" />
      <div className="space-y-6">
        <TagsSection />
        <TemplatesSection />
      </div>
    </div>
  );
}
