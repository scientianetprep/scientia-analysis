"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Trash2, Save, ImageIcon } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

type SiteSettings = {
  id: number;
  site_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  support_email: string | null;
  primary_color: string | null;
};

/**
 * Branding + site-config panel for /admin/settings.
 * Uploads go to the `branding` storage bucket (public read, admin write),
 * and the resulting public URL is persisted to `site_settings.logo_url`
 * via PATCH /api/admin/site-settings.
 */
export function BrandingClient({ initialSettings }: { initialSettings: SiteSettings }) {
  const router = useRouter();
  const supabase = createBrowserClient();
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const persist = async (patch: Partial<SiteSettings>): Promise<SiteSettings | null> => {
    const res = await fetch("/api/admin/site-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save settings");
    return data as SiteSettings;
  };

  const onUploadLogo = async (file: File) => {
    setUploading(true);
    const tid = toast.loading("Uploading logo…");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `logo/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("branding")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("branding").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const next = await persist({ logo_url: publicUrl });
      if (next) setSettings(next);
      toast.success("Logo updated", { id: tid });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Upload failed", { id: tid });
    } finally {
      setUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const onRemoveLogo = async () => {
    setRemoving(true);
    try {
      const next = await persist({ logo_url: "" });
      if (next) setSettings(next);
      toast.success("Logo removed");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

  const onSaveText = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const next = await persist({
        site_name: settings.site_name,
        support_email: settings.support_email ?? "",
      });
      if (next) setSettings(next);
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors";

  return (
    <div className="surface-card p-4 space-y-4">
      <header>
        <h2 className="text-base font-poppins font-semibold text-on-surface">Branding</h2>
        <p className="text-xs text-on-surface-variant">
          Logo and site identity shown on auth screens, sidebars, and emails.
        </p>
      </header>

      {/* Logo preview + upload */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-20 h-20 rounded-md border border-outline-variant/20 bg-surface-container-high grid place-items-center overflow-hidden">
          {settings.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logo_url}
              alt="Current site logo"
              className="w-full h-full object-contain"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-outline" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadLogo(file);
              }}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploading}
              className="h-8 px-3 rounded-md bg-tertiary text-white text-xs font-poppins font-medium hover:bg-tertiary/90 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {settings.logo_url ? "Replace logo" : "Upload logo"}
            </button>
            {settings.logo_url && (
              <button
                type="button"
                onClick={onRemoveLogo}
                disabled={removing}
                className="h-8 px-3 rounded-md border border-outline-variant/20 text-xs font-medium hover:bg-surface-container-high inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Remove
              </button>
            )}
          </div>
          <p className="text-[11px] text-outline">
            PNG / JPG / WEBP / SVG — under 5 MB. Square works best.
          </p>
        </div>
      </div>

      <form onSubmit={onSaveText} className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-outline-variant/10">
        <div>
          <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Site name</label>
          <input
            required
            type="text"
            value={settings.site_name ?? ""}
            onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Support email</label>
          <input
            type="email"
            value={settings.support_email ?? ""}
            onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
            placeholder="support@example.com"
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-3 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
