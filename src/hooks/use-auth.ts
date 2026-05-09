import { createServerClientFn } from "@/lib/supabase/server";

export async function useAuth() {
  const supabase = await createServerClientFn();
  const { data: { user } } = await supabase.auth.getUser();
  return { user };
}