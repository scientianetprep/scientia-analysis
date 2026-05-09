import { NextRequest, NextResponse } from "next/server";
import { sendEmail, emailTemplates } from "@/lib/email";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req: NextRequest) {
  try {
    const { action, to, subject, data } = await req.json();

    if (!to || !action) {
      return NextResponse.json({ error: "to and action are required" }, { status: 400 });
    }

    let html = "";
    let emailSubject = subject || "Scientia Prep Notification";

    switch (action) {
      case "feedback":
        // Send feedback to Admin — use ADMIN_EMAIL env var, fall back to GMAIL_USER, then literal
        const adminEmail = env.ADMIN_EMAIL || env.GMAIL_USER || "mayikissyouqt@gmail.com";
        
        emailSubject = `Student Feedback: ${data.category}`;
        html = `
          <h3>New feedback from ${data.from}</h3>
          <p><strong>Rating:</strong> ${data.rating}/5</p>
          <p><strong>Category:</strong> ${data.category}</p>
          <p><strong>Message:</strong></p>
          <div style="padding: 10px; background: #f4f4f4; border-radius: 5px;">${data.feedback}</div>
        `;
        
        // Also store in database
        const { data: userProfile } = await supabase.from("profiles").select("user_id").eq("email", data.from).single();
        if (userProfile) {
           await supabase.from("feedback").insert({
             user_id: userProfile.user_id,
             rating: data.rating,
             category: data.category,
             message: data.feedback
           });
        }

        await sendEmail({ to: adminEmail, subject: emailSubject, html });
        break;

      case "mfa_otp":
        emailSubject = "Your Security Code";
        html = emailTemplates.mfaOtp(data.code);
        await sendEmail({ to, subject: emailSubject, html });
        break;

      case "user_approved":
        emailSubject = "Welcome to Scientia Prep!";
        html = emailTemplates.userApproved(data.name);
        await sendEmail({ to, subject: emailSubject, html });

        // Also trigger WhatsApp via Fonnte if phone is provided
        if (data.phone) {
          try {
            await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms-fonnte`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({
                user: { phone: data.phone },
                sms: { 
                  message: `As-salamu alaykum ${data.name}! Your Scientia Prep registration has been approved. You can now login to your dashboard. Success!` 
                }
              })
            });
          } catch (e) {
            console.error("WhatsApp notification failed", e);
          }
        }
        break;

      case "custom":
        emailSubject = data.subject || "Admin Message from Scientia Prep";
        html = emailTemplates.customAdminMessage(emailSubject, data.message);
        await sendEmail({ to, subject: emailSubject, html });
        break;

      case "welcome":
        emailSubject = "Welcome to Scientia Prep!";
        html = emailTemplates.welcome(data.name);
        await sendEmail({ to, subject: emailSubject, html });
        break;

      case "account_deletion_confirmed":
        emailSubject = "Account Permanently Deleted";
        html = emailTemplates.accountDeletion(data.name);
        await sendEmail({ to, subject: emailSubject, html });
        break;

      case "account_deletion_revoked":
        emailSubject = "Account Deletion Request Cancelled";
        html = emailTemplates.accountDeletionRevoked(data.name);
        await sendEmail({ to, subject: emailSubject, html });
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Mail API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
