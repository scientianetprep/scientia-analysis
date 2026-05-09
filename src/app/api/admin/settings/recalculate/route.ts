import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/supabase/require-admin";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req: NextRequest) {
  try {
    await requireAdmin({ context: "api" });

    // 1. Get the current active formula
    const { data: formulaData, error: formulaError } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "aggregate_formula")
      .single();

    if (formulaError || !formulaData) {
      return NextResponse.json({ error: "Active formula not found" }, { status: 404 });
    }

    const { matric: wM, inter: wI, test: wT } = formulaData.value;

    // 2. Fetch all academic info
    const { data: students, error: studentsError } = await supabase
      .from("academic_info")
      .select("user_id, matric_marks, matric_total, intermediate_marks, intermediate_total, entrance_test_marks, entrance_test_total");

    if (studentsError) throw studentsError;

    // Null-safe percentage helper — students who haven't filled in
    // transcripts yet leave matric/inter/entrance as null, and dividing
    // null ends up as NaN which would write NaN back into the DB.
    const pct = (obtained: number | null, total: number | null) => {
      if (!obtained || !total || total <= 0) return 0;
      return Math.min((obtained / total) * 100, 100);
    };

    let updatedCount = 0;
    const updates = students.map((student: any) => {
      const matricP = pct(student.matric_marks, student.matric_total);
      const interP = pct(student.intermediate_marks, student.intermediate_total);
      const testP = pct(student.entrance_test_marks, student.entrance_test_total);

      const aggregate = matricP * wM + interP * wI + testP * wT;

      updatedCount++;
      return {
        user_id: student.user_id,
        aggregate_marks: parseFloat(aggregate.toFixed(2)),
        updated_at: new Date().toISOString(),
      };
    });

    // 3. Bulk update (using upsert as academic_info primary key is user_id)
    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from("academic_info")
        .upsert(updates);
      
      if (updateError) throw updateError;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Recalculated aggregate marks for ${updatedCount} students.`,
      count: updatedCount
    });

  } catch (error: any) {
    console.error("Recalculate API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
