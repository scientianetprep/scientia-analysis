"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { User, Loader2, Camera, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface AvatarUploadProps {
  userId: string;
  currentUrl?: string;
}

export function AvatarUpload({ userId, currentUrl }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const supabase = createBrowserClient();

  // Extracts the path inside the `avatars` bucket from a public URL so we
  // can feed it to `storage.remove()`. Returns null if the URL doesn't
  // look like a Supabase storage URL (e.g. legacy Gravatar/OAuth avatars)
  // — in that case we only clear the profile column.
  const pathFromPublicUrl = (url?: string): string | null => {
    if (!url) return null;
    const marker = "/storage/v1/object/public/avatars/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const handleRemove = async () => {
    if (!previewUrl) return;
    if (
      !(await confirm({
        title: "Remove profile photo?",
        description: "This deletes the image from storage. You can upload a new one anytime.",
        confirmLabel: "Remove",
        variant: "warning",
      }))
    ) {
      return;
    }
    setRemoving(true);
    const tid = toast.loading("Removing photo…");
    try {
      const path = pathFromPublicUrl(previewUrl);
      if (path) {
        const { error: rmErr } = await supabase.storage.from("avatars").remove([path]);
        // storage errors are non-fatal — the object might already be gone,
        // but we still want the profile column cleared.
        if (rmErr) console.warn("[avatar remove] storage:", rmErr.message);
      }
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("user_id", userId);
      if (upErr) throw new Error(upErr.message);
      setPreviewUrl("");
      toast.success("Photo removed", { id: tid });
    } catch (err: any) {
      toast.error(err?.message || "Remove failed", { id: tid });
    } finally {
      setRemoving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error("Invalid file format", { description: "Please upload a PNG, JPG, or WebP image." });
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
         toast.error("File is too large", { description: "Maximum image size allowed is 2MB." });
         return;
      }

      setUploading(true);
      
      const uploadPromise = async () => {
        const fileExt = file.name.split('.').pop();
        const filePath = `${userId}/avatar-${Math.random()}.${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw new Error(uploadError.message);

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        // Update Profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('user_id', userId);

        if (updateError) throw new Error(updateError.message);

        setPreviewUrl(publicUrl);
        return publicUrl;
      };

      toast.promise(uploadPromise(), {
        loading: "Uploading your avatar securely...",
        success: "Identity updated. Your profile avatar has been synchronized.",
        error: (err: unknown) => `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
      });

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "An unknown error occurred";
      toast.error("Upload failed", { description: msg });
    } finally {
      // Small delay on local state to let transitions finish
      setTimeout(() => setUploading(false), 500);
      e.target.value = ""; // Reset input
    }
  };

  return (
    <div className="relative group">
      <div
        className={cn(
          "w-20 h-20 rounded-lg bg-surface-container-high border border-outline-variant/20 flex items-center justify-center overflow-hidden relative",
          uploading && "opacity-50"
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <User className="w-8 h-8 text-outline/40" />
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Update profile avatar"
          className="absolute inset-0 w-full h-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-tertiary focus-visible:outline-none"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Camera className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="sr-only"
        onChange={handleUpload}
        disabled={uploading}
        aria-hidden="true"
      />

      {uploading && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-tertiary flex items-center justify-center pointer-events-none">
          <Loader2 className="w-3 h-3 text-white animate-spin" />
        </div>
      )}

      {previewUrl && !uploading && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          aria-label="Remove profile photo"
          title="Remove photo"
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white grid place-items-center disabled:opacity-60 transition-colors"
        >
          {removing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-2.5 h-2.5" />
          )}
        </button>
      )}
    </div>
  );
}
