import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
  
  const { data, error } = await supabase
    .from("exam_sessions")
    .update({ 
      status: "auto_submitted", 
      ended_at: new Date().toISOString(),
      submitted_at: new Date().toISOString()
    })
    .eq("status", "in_progress");

  if (error) {
    console.error("Cleanup failed:", error);
  }
}

cleanup();
