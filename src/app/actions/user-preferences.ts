"use server";

import { createServerClientFn } from "@/lib/supabase/server";

export async function dismissMfaPrompt() {
  const supabase = await createServerClientFn();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not logged in" };
  }

  // Create or update preference
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: user.id, mfa_prompt_dismissed: true }, { onConflict: 'user_id' });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
