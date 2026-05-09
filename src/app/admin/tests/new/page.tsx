import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { TestBuilderForm } from "@/components/admin/TestBuilderForm";

export const metadata = { title: "New Test — Admin" };

export default async function AdminNewTestPage() {
  await requireAdmin();
  return (
    <div className="animate-fade-in">
      <TestBuilderForm />
    </div>
  );
}
