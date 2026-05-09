import { z } from "zod";

const envSchema = z.object({
  // Supabase (required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional().default("http://localhost:3000"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(32),

  // Cloudflare R2 (optional - for file uploads)
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET_NAME: z.string().optional(),

  // Payments (optional)
  SAFEPAY_API_KEY: z.string().optional(),
  SAFEPAY_SECRET_KEY: z.string().optional(),
  SAFEPAY_WEBHOOK_SECRET: z.string().optional(),

  // SMS (optional)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),

  // Gmail SMTP
  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(), // Receives feedback & admin notifications (defaults to GMAIL_USER)

  // Fonnte (optional)
  FONNTE_TOKEN: z.string().optional(),
  FONNTE_ENDPOINT: z.string().url().optional(),

  // Chat (optional)
  STREAM_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STREAM_API_KEY: z.string().optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional().default("http://localhost:3000"),
  NEXT_PUBLIC_STREAM_API_KEY: z.string().optional(),
});

function validateEnv() {
  if (typeof window !== "undefined") {
    return {} as z.infer<typeof envSchema>;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    });
    // Return empty object during build to satisfy TS, but throw at runtime if production
    if (process.env.NODE_ENV === "production" && !process.env.NEXT_PHASE) {
       throw new Error("Missing or invalid environment variables");
    }
    return (result.data || {}) as z.infer<typeof envSchema>;
  }

  return result.data;
}

function getClientEnv() {
  // Only parse public variables to avoid leaking
  const publicEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_STREAM_API_KEY: process.env.NEXT_PUBLIC_STREAM_API_KEY,
  };

  const result = clientEnvSchema.safeParse(publicEnv);

  if (!result.success) {
    console.error("Invalid client environment variables:", result.error.format());
    // Fallback or handle gracefully during build
    return publicEnv as z.infer<typeof clientEnvSchema>;
  }

  return result.data;
}

const env = validateEnv();
const clientEnv = getClientEnv();

export { env, clientEnv };

export type Env = typeof env;
export type ClientEnv = typeof clientEnv;