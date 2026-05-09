"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createBrowserClient } from "@/lib/supabase/client";

export function DeleteTestButton({ testId, testName }: { testId: string; testName: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const confirm = useConfirm();
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete Test?",
      description: `Are you sure you want to delete "${testName}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });

    if (!ok) return;

    setIsDeleting(true);
    const tid = toast.loading("Deleting test...");

    try {
      const { error } = await supabase
        .from("tests")
        .delete()
        .eq("id", testId);

      if (error) throw error;

      toast.success("Test deleted", { id: tid });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete test", { id: tid });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-container-high border border-outline-variant/20 text-outline hover:text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-50"
      title="Delete test"
    >
      {isDeleting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
