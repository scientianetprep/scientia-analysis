import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionContext } from "@/lib/supabase/session-cache";
import { QuizEngine } from "@/components/dashboard/QuizEngine";
import { TestUnlockGate } from "@/components/dashboard/TestUnlockGate";
import { CreditConfirmGate } from "@/components/dashboard/CreditConfirmGate";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ testId: string }>;
}

export default async function QuizPage({ params }: PageProps) {
  const { testId } = await params;

  // Plan task 2.5 — shares the /auth/v1/user verification with
  // DashboardLayout (which runs first). Trims ~100 ms off every test
  // page load on warm connections.
  const { user, supabase } = await getSessionContext();
  if (!user) redirect("/login");

  // Fetch test, profile, and the most recent session in parallel. The
  // profile row drives the candidate strip (name + @username) in the
  // session UI. The latest session is used as a gate: if the user just
  // submitted this test in the last minute, bounce them back to the
  // dashboard so navigating back via the browser history doesn't re-
  // enter a quiz shell for a session that's already closed on the
  // server.
  const [testRes, profileRes, sessionRes] = await Promise.all([
    supabase
      .from("tests")
      .select(
        "id, name, subject, time_limit, question_ids, is_published, description, instructions, negative_marking, shuffle_questions, shuffle_options, show_results, is_full_length, sections, access_password, max_attempts"
      )
      .eq("id", testId)
      // maybeSingle so a soft-deleted / RLS-denied test renders the
      // Next.js 404 page instead of crashing the route with
      // "This page couldn't load" (PostgREST throws on .single() when
      // zero rows are returned, which prop-drills as a server error).
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, username")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("exam_sessions")
      .select("id, status, submitted_at")
      .eq("test_id", testId)
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Surface PostgREST errors in server logs instead of letting them
  // bubble into the opaque "This page couldn't load" global error UI.
  // `maybeSingle()` only swallows "row not found" — permission denied
  // (42501), relation missing (42P01), or SQL errors still set `error`.
  if (testRes.error) {
    console.error("[v0] test fetch failed", testRes.error);
  }
  if (profileRes.error) {
    console.error("[v0] profile fetch failed", profileRes.error);
  }
  if (sessionRes.error) {
    console.error("[v0] latest session fetch failed", sessionRes.error);
  }

  const test = testRes.data;
  const profile = profileRes.data;
  const latestSession = sessionRes.data;

  if (!test) notFound();

  // Password gate. Admins can set tests.access_password to a shared
  // classroom code (empty/null = free access). If set, we require the
  // student to redeem the code via /api/exam/unlock, which drops a
  // path-scoped HttpOnly cookie. When that cookie is present we render
  // the quiz; otherwise we render the TestUnlockGate prompt.
  const hasPassword = test.access_password && String(test.access_password).trim() !== "" && test.access_password !== "null" && test.access_password !== "undefined";
  if (hasPassword) {
    const jar = await cookies();
    const unlocked = jar.get(`exam_unlock_${testId}`)?.value === "1";
    if (!unlocked) {
      return (
        <TestUnlockGate
          testId={test.id}
          testName={test.name}
          subject={test.subject ?? null}
        />
      );
    }
  }

  // "Instant close" guard. If the user just submitted/was auto-submitted/
  // timed out within the last 60 seconds we do not re-render the quiz
  // shell — send them back to the dashboard. Outside this window the
  // normal flow (new attempt if under max_attempts, else the attempt-
  // limit page below) handles things.
  if (
    latestSession &&
    latestSession.status !== "in_progress" &&
    latestSession.submitted_at
  ) {
    const closedMs = Date.now() - new Date(latestSession.submitted_at).getTime();
    if (closedMs < 60_000) redirect("/dashboard?submitted=1");
  }

  // Enforce Max Attempts Rule
  const { data: previousScores } = await supabase
    .from("scores")
    .select("id")
    .eq("test_id", testId)
    .eq("user_id", user.id);

  const maxAttempts = test.max_attempts;

  if (maxAttempts && previousScores && previousScores.length >= maxAttempts) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center gap-3 bg-surface">
        <div className="w-12 h-12 rounded-md bg-surface-container-high border border-outline-variant/20 flex items-center justify-center">
          <span className="text-xl font-poppins font-semibold text-on-surface">!</span>
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-poppins font-semibold text-on-surface">
            Attempt limit exceeded
          </h2>
          <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
            You have reached the maximum allowed attempts ({maxAttempts}) for this test.
          </p>
        </div>
        <Link
          href="/dashboard/tests"
          className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm font-poppins font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          Back to test series
        </Link>
      </div>
    );
  }

  // ── Credit gate ─────────────────────────────────────────────────
  const [priceRow, unlockRow] = await Promise.all([
    supabase
      .from("content_prices")
      .select("credit_cost, is_free")
      .eq("content_type", "test")
      .eq("content_id", testId)
      .maybeSingle(),
    supabase
      .from("content_unlocks")
      .select("id")
      .eq("user_id", user.id)
      .eq("content_type", "test")
      .eq("content_id", testId)
      .maybeSingle(),
  ]);

  const creditCost =
    priceRow.data && !priceRow.data.is_free
      ? (priceRow.data.credit_cost ?? 0)
      : 0;

  // Access decision: unlocked if the unlock record exists OR cost is 0
  let hasAccess = !creditCost || !!unlockRow.data;

  // Fallback for legacy purchases: student may have paid via the old
  // server-side spend_credits flow before content_unlocks was introduced.
  // If credit_transactions shows a matching spend, auto-create the unlock
  // record so they aren't charged again.
  if (creditCost > 0 && !unlockRow.data) {
    const { data: txn } = await supabase
      .from("credit_transactions")
      .select("id, amount")
      .eq("user_id", user.id)
      .eq("ref_id", testId)
      .eq("ref_type", "test")
      .lt("amount", 0) // debits are negative
      .limit(1)
      .maybeSingle();

    if (txn) {
      // Backfill the unlock record via the spend API (idempotent, 0-cost path)
      // Use admin client to bypass RLS for the insert
      const { adminClient } = await import("@/lib/supabase/admin");
      await adminClient.from("content_unlocks").upsert(
        {
          user_id: user.id,
          content_type: "test",
          content_id: testId,
          credits_spent: Math.abs(txn.amount),
        },
        { onConflict: "user_id,content_type,content_id", ignoreDuplicates: true }
      );
      hasAccess = true;
    }
  }

  if (!hasAccess) {
    const { data: account } = await supabase
      .from("credit_accounts")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    return (
      <CreditConfirmGate
        contentType="test"
        contentId={testId}
        contentName={test.name}
        contentSubject={test.subject ?? null}
        creditCost={creditCost}
        balance={account?.balance ?? 0}
        backHref="/dashboard/tests"
      />
    );
  }
  // ── End credit gate ──────────────────────────────────────────────

  // Fetch Questions in the test's preferred sequence
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select(
      "id, text, option_a, option_b, option_c, option_d, correct, explanation, subject, topic, difficulty, marks, bloom_level, tags, image_url, image_position"
    )
    .in("id", test.question_ids || []);

  if (questionsError) {
    // Most common cause on this route is an RLS denial when the student's
    // profile.status isn't "active" yet. We log (prefixed so it's easy to
    // grep in vercel logs) and fall through to the "Test content not
    // ready" guard below instead of 500-ing the whole page.
    console.error(
      `[v0] questions fetch failed for test ${testId}, user ${user.id}:`,
      questionsError
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center gap-3 bg-surface">
        <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
          <span className="text-xl font-poppins font-semibold text-outline">!</span>
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-poppins font-semibold text-on-surface">
            Test content not ready
          </h2>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
            This practice module has no questions assigned yet. Contact the administrator.
          </p>
        </div>
        <Link
          href="/dashboard/tests"
          className="text-sm text-tertiary font-poppins font-medium hover:underline"
        >
          Back to test series
        </Link>
      </div>
    );
  }

  // Ensure questions follow the test.question_ids order if provided
  const orderedQuestions = test.question_ids
    ? test.question_ids.map((id: string) => questions.find((q: any) => q.id === id)).filter(Boolean)
    : questions;

  // Only surface sections to the client when the test is actually marked
  // full-length and has usable data. The schema defaults to an empty
  // array, so a non-full-length test just gets `undefined` here and the
  // engine hides the Next/Prev Section affordances.
  const sections =
    test.is_full_length && Array.isArray(test.sections) && test.sections.length > 0
      ? (test.sections as Array<{
          name: string;
          subject: string;
          question_ids: string[];
        }>)
      : undefined;

  return (
    <QuizEngine
      test={test}
      questions={orderedQuestions as any}
      userId={user.id}
      student={{
        fullName: profile?.full_name ?? "Candidate",
        username: profile?.username ?? null,
      }}
      sections={sections}
    />
  );
}
