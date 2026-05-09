import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { format } from "date-fns";
import { DeletionActionButtons } from "./actions-client";

export const metadata = { title: "Deletion Requests — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDeletionsPage() {
  await requireAdmin();

  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: requests } = await adminClient
    .from("account_deletion_requests")
    .select(`
      id,
      user_id,
      reason,
      status,
      created_at,
      profiles!account_deletion_requests_user_id_fkey (
        full_name,
        email,
        phone
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Deletion requests
        </h1>
        <p className="text-sm text-on-surface-variant">
          Pending account deletion requests from students.
        </p>
      </div>

      {requests && requests.length > 0 ? (
        <>
          {/* Desktop */}
          <div className="hidden md:block surface-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-high/60 text-xs text-outline">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Student</th>
                  <th className="px-3 py-2.5 text-left font-medium">Reason</th>
                  <th className="px-3 py-2.5 text-left font-medium">Requested</th>
                  <th className="px-3 py-2.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {requests.map((req) => (
                  <tr key={req.id} className="h-12 hover:bg-surface-container-high/40">
                    <td className="px-3">
                      <div className="flex flex-col">
                        <span className="text-on-surface font-medium">
                          {(req.profiles as any)?.full_name}
                        </span>
                        <span className="text-outline text-[11px]">
                          {(req.profiles as any)?.email} · {(req.profiles as any)?.phone}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 text-on-surface-variant">
                      <p className="max-w-xs truncate" title={req.reason}>
                        {req.reason || "—"}
                      </p>
                    </td>
                    <td className="px-3 text-outline text-xs">
                      {format(new Date(req.created_at), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="px-3 text-right">
                      <DeletionActionButtons request={req} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="surface-card p-3 space-y-1.5">
                <div>
                  <div className="font-medium text-on-surface">{(req.profiles as any)?.full_name}</div>
                  <div className="text-[11px] text-outline">
                    {(req.profiles as any)?.email} · {(req.profiles as any)?.phone}
                  </div>
                </div>
                <p className="text-sm text-on-surface-variant">{req.reason || "No reason provided"}</p>
                <div className="text-[11px] text-outline">
                  {format(new Date(req.created_at), "MMM d, yyyy HH:mm")}
                </div>
                <div className="flex justify-end">
                  <DeletionActionButtons request={req} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="surface-card p-8 text-center flex flex-col items-center">
          <div className="w-10 h-10 rounded-md bg-green-500/10 text-green-600 grid place-items-center mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-sm font-poppins font-semibold text-on-surface">No pending requests</h3>
          <p className="text-xs text-on-surface-variant">All clear — nothing to review.</p>
        </div>
      )}
    </div>
  );
}
