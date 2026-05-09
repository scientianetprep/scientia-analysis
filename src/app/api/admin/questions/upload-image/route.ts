import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Upload a question illustration / graph to the `question-images`
 * Storage bucket. Runs as the admin service-role client so the write
 * bypasses storage RLS while still being gated behind `requireAdmin()`.
 *
 * Request:  multipart/form-data with a single `file` field.
 * Response: { url: string } — the public URL to persist on
 *           `questions.image_url`.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin({ context: "api" });
    if (gate instanceof Response) return gate;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // Same validation as the avatar uploader to keep behavior consistent.
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported format. Use PNG, JPG, WebP or GIF." },
        { status: 400 }
      );
    }
    // 5MB — graphs can include anti-aliased vector exports that are
    // larger than avatars; still bounded to avoid abuse.
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File is larger than 5MB" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    // Use a random segment in the path so re-uploads don't overwrite
    // cached images — CDNs may otherwise serve the previous version for
    // a while after an admin swaps the illustration.
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await adminClient.storage
      .from("question-images")
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = adminClient.storage.from("question-images").getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl, path });
  } catch (err: any) {
    if (err?.message === "MFA_REQUIRED")
      return NextResponse.json({ error: "MFA Required" }, { status: 403 });
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
