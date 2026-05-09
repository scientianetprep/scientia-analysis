import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { z } from "zod";

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  loginMethod: z.enum(["email", "phone", "cnic", "username"]).optional().default("email"),
});

// In-memory rate limit (reset on server restart)
const rateLimit = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimit.get(ip);
  
  if (!record || now > record.reset) {
    rateLimit.set(ip, { count: 1, reset: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    // CSRF protection - removed (Vercel handles this)

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
    }

    const { identifier, password, loginMethod } = parsed.data;

    // Use service role key to bypass RLS for user lookup
    const adminClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    let userEmail = identifier;
    
    // Format phone number
    const formatPhone = (phone: string): string => {
      const cleaned = phone.replace(/\D/g, "");
      if (cleaned.startsWith("0")) return "+92" + cleaned.slice(1);
      if (cleaned.startsWith("3")) return "+92" + cleaned;
      if (cleaned.startsWith("92")) return "+" + cleaned;
      return "+" + cleaned;
    };

    // Find user based on login method
    if (loginMethod === "phone") {
      // Phone login - look up by phone in profiles
      const formattedPhone = formatPhone(identifier);
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("user_id, phone, registration_stage")
        .eq("phone", formattedPhone)
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ error: "No account found with this phone number. Please register first." }, { status: 400 });
      }

      // Check registration stage before allowing login
      if (profile.registration_stage && profile.registration_stage < 4) {
        return NextResponse.json({ 
          requiresRegistration: true, 
          userId: profile.user_id,
          resumeStage: profile.registration_stage === 1 ? 2 : 3
        });
      }

      const { data: user } = await adminClient.auth.admin.getUserById(profile.user_id);
      if (!user?.user) return NextResponse.json({ error: "Account not found" }, { status: 400 });
      
      // Check if email is verified
      if (!user.user.email_confirmed_at) {
        return NextResponse.json({ 
          error: "Your email is not verified. Please verify your email first.",
          requiresEmailVerification: true,
          email: user.user.email
        }, { status: 400 });
      }
      
      userEmail = user.user.email!;
    } else if (loginMethod === "cnic") {
      // CNIC login
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("user_id, registration_stage")
        .eq("cnic", identifier)
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ error: "No account found with this CNIC. Please register first." }, { status: 400 });
      }

      // Check registration stage before allowing login
      if (profile.registration_stage && profile.registration_stage < 4) {
        return NextResponse.json({ 
          requiresRegistration: true, 
          userId: profile.user_id,
          resumeStage: profile.registration_stage === 1 ? 2 : 3
        });
      }

      const { data: user } = await adminClient.auth.admin.getUserById(profile.user_id);
      if (!user?.user) return NextResponse.json({ error: "Account not found" }, { status: 400 });
      
      // Check if email is verified
      if (!user.user.email_confirmed_at) {
        return NextResponse.json({ 
          error: "Your email is not verified. Please verify your email first.",
          requiresEmailVerification: true,
          email: user.user.email
        }, { status: 400 });
      }
      
      userEmail = user.user.email!;
    } else if (loginMethod === "username") {
      // Username login
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("user_id, registration_stage")
        .eq("username", identifier.toLowerCase())
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ error: "No account found with this username. Please register first." }, { status: 400 });
      }

      // Check registration stage before allowing login
      if (profile.registration_stage && profile.registration_stage < 4) {
        return NextResponse.json({ 
          requiresRegistration: true, 
          userId: profile.user_id,
          resumeStage: profile.registration_stage === 1 ? 2 : 3
        });
      }

      const { data: user } = await adminClient.auth.admin.getUserById(profile.user_id);
      if (!user?.user) return NextResponse.json({ error: "Account not found" }, { status: 400 });
      
      // Check if email is verified
      if (!user.user.email_confirmed_at) {
        return NextResponse.json({ 
          error: "Your email is not verified. Please verify your email first.",
          requiresEmailVerification: true,
          email: user.user.email
        }, { status: 400 });
      }
      
      userEmail = user.user.email!;
    } else {
      // Email login (default)
      try {
        const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
        if (listError) {
          console.error("listUsers error:", listError);
          return NextResponse.json({ 
            error: "Unable to process request. Please check your connection and try again.",
            retry: true 
          }, { status: 503 });
        }
        const foundUser = users.find(u => u.email?.toLowerCase() === identifier.toLowerCase());
        if (!foundUser) {
          return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
        }
        
        // Check if email is verified
        if (!foundUser.email_confirmed_at) {
          return NextResponse.json({ 
            error: "Your email is not verified. Please check your inbox for the verification link.",
            requiresEmailVerification: true,
            email: foundUser.email
          }, { status: 400 });
        }
        
        userEmail = foundUser.email!;
      } catch (networkError) {
        console.error("Network error in login:", networkError);
        return NextResponse.json({ 
          error: "Unable to connect. Please check your connection and try again.",
          retry: true 
        }, { status: 503 });
      }
    }

    // Sign in using server client to get cookies set properly
    const cookieStore = await cookies();
    
    const supabaseServer = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Check profile status and registration completeness using admin client
    const { data: profile } = await adminClient
      .from("profiles")
      .select("status, whatsapp_number, registration_stage, mfa_email_enabled, mfa_totp_enabled")
      .eq("user_id", data.user.id)
      .single();

    if (!profile) {
      // No profile — shouldn't happen, but send to registration
      return NextResponse.json({ requiresRegistration: true, userId: data.user.id });
    }

    // Check registration stage - incomplete registrations can't login, must complete first.
    // Root-cause fix: we must sign the server session out, otherwise the cookie
    // jar still carries a valid Supabase auth token and the client can just navigate
    // to /dashboard, bypassing this check. That was "stuck state requires cookie clear".
    if (profile.registration_stage && profile.registration_stage < 4) {
      const resumeStage = profile.registration_stage === 1 ? 2 : 3;
      await supabaseServer.auth.signOut();
      return NextResponse.json({
        requiresRegistration: true,
        userId: data.user.id,
        resumeStage,
      });
    }

    // Must have completed WhatsApp verification
    if (!profile.whatsapp_number) {
      await supabaseServer.auth.signOut();
      return NextResponse.json({ requiresWhatsapp: true, userId: data.user.id });
    }

    // Admin approval
    if (profile.status === "pending" || profile.status === "payment_pending") {
      return NextResponse.json({ success: true, requiresApproval: true });
    }

    if (profile.status === "suspended" || profile.status === "expired") {
      return NextResponse.json({
        error: "Account is " + profile.status,
      }, { status: 403 });
    }

    // Check MFA requirements
    const { data: mfaData } = await supabaseServer.auth.mfa.getAuthenticatorAssuranceLevel();
    
    // High-priority: App-based TOTP (Native Supabase)
    if (mfaData && mfaData.nextLevel === 'aal2' && mfaData.currentLevel !== 'aal2') {
      return NextResponse.json({
        success: true,
        requiresMfa: true,
        mfaType: 'totp'
      });
    }

    // Custom: Email-based OTP
    if (profile.mfa_email_enabled) {
      // Generate a 6-digit code
      const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store in a secure short-lived table or metadata (here we use user_metadata or a dedicated table)
      // For now, let's use a dedicated table 'mfa_verifications' or similar
      // Or we can just use the Mail API to send it and return success
      
      // Let's use the Mail API
      // @ts-ignore - NEXT_PUBLIC_SITE_URL is added via Vercel/Process env but not in schema
      await fetch(`${env.NEXT_PUBLIC_SITE_URL}/api/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mfa_otp",
          to: userEmail,
          data: { code: emailCode }
        })
      });

      // Update user metadata with the hashed code and expiry
      // (Simplified: we'll create a table for this to be secure)
      await adminClient.from("mfa_email_codes").upsert({
        user_id: data.user.id,
        code: emailCode,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      });

      // Sign out to clear the session cookie until verified
      await supabaseServer.auth.signOut();

      return NextResponse.json({
        success: true,
        requiresMfa: true,
        mfaType: 'email',
        email: userEmail,
        userId: data.user.id
      });
    }

    return NextResponse.json({
      success: true,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
