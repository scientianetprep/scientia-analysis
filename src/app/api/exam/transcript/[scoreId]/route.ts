import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scoreId: string }> }
) {
  const { scoreId } = await params;
  const supabase = await createServerClientFn();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    // 1. Fetch score and verify ownership
    const { data: score, error: scoreErr } = await supabase
      .from("scores")
      .select(
        "*, tests!scores_test_id_fkey(*), profiles!scores_user_profile_fkey(full_name)"
      )
      .eq("id", scoreId)
      .single();

    if (scoreErr || !score) return new Response("Transcript Not Found", { status: 404 });
    
    // Security: Only the owner or an admin can view the transcript
    const isAdmin = ["admin", "super_admin", "examiner"].includes(user.app_metadata.role || "");
    if (score.user_id !== user.id && !isAdmin) {
      return new Response("Forbidden", { status: 403 });
    }

    // 2. Fetch answers
    const { data: session } = await supabase
      .from("exam_sessions")
      .select("id, status")
      .eq("score_id", scoreId)
      .single();

    // STRICT VALIDATION: Session must be submitted
    if (!session || session.status !== "submitted") {
      return new Response("Cannot generate transcript for incomplete sessions", { status: 400 });
    }

    const { data: answers } = await supabase
      .from("exam_answers")
      .select("*, questions(*)")
      .eq("session_id", session.id);

    // 3. Generate a HTML/Printable Transcript (Simple for now)
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transcript - ${score.tests.name}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1a1c1e; }
            .header { border-bottom: 2px solid #006494; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; margin: 0; }
            .meta { color: #5e6064; margin-top: 10px; }
            .score-box { background: #f0f4f8; padding: 20px; border-radius: 12px; display: inline-block; margin-bottom: 30px; }
            .score-val { font-size: 32px; font-weight: 800; color: #006494; }
            .question { margin-bottom: 25px; page-break-inside: avoid; }
            .q-text { font-weight: bold; margin-bottom: 8px; }
            .q-meta { font-size: 12px; color: #8d9196; margin-bottom: 5px; }
            .status { font-weight: bold; }
            .correct { color: #2e7d32; }
            .wrong { color: #d32f2f; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Scientia Prep - Official Transcript</div>
            <div class="meta">
              <strong>Student:</strong> ${score.profiles?.full_name} | 
              <strong>Test:</strong> ${score.tests.name} | 
              <strong>Date:</strong> ${new Date(score.created_at).toLocaleDateString()}
            </div>
          </div>

          <div class="score-box">
             <div class="score-val">${Math.round(score.percentage)}%</div>
             <div class="meta">${score.correct_count} / ${score.total_count} Correct Answers</div>
          </div>

          <h3>Detailed Question Review</h3>
          ${(answers || []).map((ans, idx) => `
            <div class="question">
              <div class="q-meta">Question ${idx + 1} • ${ans.questions.subject} / ${ans.questions.topic}</div>
              <div class="q-text">${ans.questions.text}</div>
              <div class="status ${ans.selected === ans.questions.correct ? 'correct' : 'wrong'}">
                ${ans.selected === ans.questions.correct ? '✓ Correct' : '✗ Incorrect (Correct: ' + ans.questions.correct + ')'}
              </div>
              <div class="meta">Selected Option: ${ans.selected || 'No Answer'}</div>
            </div>
          `).join('')}
          
          <script>window.print();</script>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}
