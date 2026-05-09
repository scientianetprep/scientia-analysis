import 'server-only';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import {
  Users,
  BookOpen,
  ShieldAlert,
  Activity,
  FileQuestion,
  FilePlus,
  Send,
  UserCheck,
  ChevronRight,
  Clock,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Admin Overview — Scientia Prep' };

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function AdminHomePage() {
  await requireAdmin();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const [
    { count: totalUsers },
    { count: pendingUsers },
    { count: totalQuestions },
    { count: activeSessions },
    { data: recentFeedback },
    { data: auditEvents },
    { data: sessionEvents },
    { data: paymentEvents },
    { data: feedbackEvents },
    { data: pendingDeletions },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'pending'),
    supabase.from('questions').select('*', { count: 'exact', head: true }).neq('status', 'retired'),
    // Root-cause fix for "Live 30 is always 30": stale sessions never get
    // status-flipped to completed/abandoned (browser close, server restart, etc),
    // so they pile up with status='in_progress' forever. We count only sessions
    // with recent activity (last 2 hours) — anything older is a zombie.
    supabase
      .from('exam_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress')
      .gte('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()),
    supabase.from('feedback').select('id, category, rating, message, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(5),
    // Root-cause fix for "activity feed always shows audit-only noise"
    // (plan-P4.1): union audit log + recent exam starts + new payments +
    // new feedback into a unified timeline sorted by time.
    supabase
      .from('admin_audit_log')
      .select('id, action, created_at, profiles!admin_audit_log_admin_profile_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('exam_sessions')
      .select('id, started_at, status, profiles!exam_sessions_user_profile_fkey(full_name), tests!exam_sessions_test_id_fkey(name)')
      .order('started_at', { ascending: false })
      .limit(6),
    supabase
      .from('payments')
      .select('id, created_at, status, amount, currency, profiles!payments_user_profile_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('feedback')
      .select('id, category, created_at, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('account_deletion_requests').select('id, reason, created_at, profiles!account_deletion_requests_user_id_fkey(full_name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
  ]);

  // Unified activity timeline — newest first, capped at 8 rows.
  type ActivityRow = {
    id: string;
    kind: 'audit' | 'session' | 'payment' | 'feedback';
    at: string;
    label: string;
    actor?: string | null;
  };
  const activity: ActivityRow[] = [
    ...(auditEvents ?? []).map((a: any) => ({
      id: `audit-${a.id}`,
      kind: 'audit' as const,
      at: a.created_at,
      label: a.action,
      actor: a.profiles?.full_name ?? 'System',
    })),
    ...(sessionEvents ?? []).map((s: any) => ({
      id: `session-${s.id}`,
      kind: 'session' as const,
      at: s.started_at,
      label: `${s.status === 'completed' ? 'Completed' : 'Started'} ${s.tests?.name ?? 'test'}`,
      actor: s.profiles?.full_name ?? 'Unknown',
    })),
    ...(paymentEvents ?? []).map((p: any) => ({
      id: `payment-${p.id}`,
      kind: 'payment' as const,
      at: p.created_at,
      label: `${p.status === 'paid' ? 'Paid' : p.status === 'rejected' ? 'Rejected' : 'Submitted'} payment · ${p.currency ?? 'PKR'} ${p.amount}`,
      actor: p.profiles?.full_name ?? 'Unknown',
    })),
    ...(feedbackEvents ?? []).map((f: any) => ({
      id: `feedback-${f.id}`,
      kind: 'feedback' as const,
      at: f.created_at,
      label: `Feedback · ${f.category}`,
      actor: f.profiles?.full_name ?? 'Unknown',
    })),
  ]
    .filter((row) => row.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const stats: {
    label: string;
    value: number;
    icon: any;
    color: string;
    bg: string;
    href: string;
  }[] = [
    { label: 'Students', value: totalUsers ?? 0, icon: Users, color: 'text-tertiary', bg: 'bg-tertiary/10', href: '/admin/users' },
    { label: 'Pending', value: pendingUsers ?? 0, icon: ShieldAlert, color: 'text-amber-500', bg: 'bg-amber-500/10', href: '/admin/users?filter=pending' },
    { label: 'Questions', value: totalQuestions ?? 0, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10', href: '/admin/questions' },
    { label: 'Live', value: activeSessions ?? 0, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10', href: '/admin/proctor' },
  ];

  const quickActions = [
    { label: `Review ${pendingUsers ?? 0} approvals`, href: '/admin/users?filter=pending', icon: UserCheck, urgent: (pendingUsers ?? 0) > 0 },
    { label: `${pendingDeletions?.length ?? 0} deletion requests`, href: '/admin/deletions', icon: ShieldAlert, urgent: (pendingDeletions?.length ?? 0) > 0 },
    { label: 'Add question', href: '/admin/questions', icon: FileQuestion, urgent: false },
    { label: 'New test', href: '/admin/tests/new', icon: FilePlus, urgent: false },
    { label: 'Send email', href: '/admin/email', icon: Send, urgent: false },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Admin overview
        </h1>
        <p className="text-sm text-on-surface-variant">
          Real-time platform health and pending actions.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link
            key={label}
            href={href}
            className="surface-card p-3 flex items-center gap-2.5 hover:border-tertiary/30 transition-colors"
          >
            <div className={cn('w-8 h-8 rounded-md grid place-items-center shrink-0', bg)}>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-poppins font-semibold text-on-surface leading-none tabular-nums">
                {value}
              </p>
              <p className="text-[11px] text-outline mt-0.5">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Quick actions */}
        <section className="surface-card p-3 lg:col-span-1">
          <h2 className="text-xs font-medium text-outline px-0.5 mb-2">
            Quick actions
          </h2>
          <ul className="space-y-1">
            {quickActions.map(({ label, href, icon: Icon, urgent }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center justify-between h-9 px-2.5 rounded-md text-xs font-medium transition-colors',
                    urgent
                      ? 'text-amber-600 bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent activity — unified timeline across audit/sessions/payments/feedback */}
        <section className="surface-card p-3 lg:col-span-1">
          <h2 className="text-xs font-medium text-outline px-0.5 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Recent activity
          </h2>
          {activity.length > 0 ? (
            <ul className="space-y-2">
              {activity.map((row) => {
                const dotColor =
                  row.kind === 'payment'
                    ? 'bg-green-500'
                    : row.kind === 'session'
                      ? 'bg-blue-500'
                      : row.kind === 'feedback'
                        ? 'bg-amber-500'
                        : 'bg-tertiary';
                const rel = relativeTime(row.at);
                return (
                  <li key={row.id} className="flex items-start gap-2">
                    <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', dotColor)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-on-surface truncate">{row.label}</p>
                      <p className="text-[11px] text-outline truncate">
                        {row.actor ? `${row.actor} · ` : ''}
                        {rel}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-outline text-center py-4">No recent activity</p>
          )}
        </section>

        {/* Recent feedback */}
        <section className="surface-card p-3 lg:col-span-1">
          <h2 className="text-xs font-medium text-outline px-0.5 mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Recent feedback
          </h2>
          {recentFeedback && recentFeedback.length > 0 ? (
            <ul className="space-y-2">
              {recentFeedback.map((fb: any) => (
                <li
                  key={fb.id}
                  className="p-2 rounded-md bg-surface-container-high"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-outline font-medium uppercase">
                      {fb.category}
                    </span>
                    <span className="text-[10px] text-tertiary">
                      {'★'.repeat(fb.rating)}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-2">
                    {fb.message}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-outline text-center py-4">
              No feedback yet
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
