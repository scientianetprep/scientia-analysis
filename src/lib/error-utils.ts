/**
 * Scientia Prep Friendly Error Handler
 * Translates technical error codes and messages into warm, helpful language.
 */

export const FRIENDLY_ERRORS: Record<string, string> = {
  // Auth Errors
  "invalid_credentials": "The email or password you entered doesn’t seem right. Please double-check and try again.",
  "email_not_confirmed": "Please check your inbox! You need to confirm your email address before you can sign in.",
  "user_not_found": "We couldn't find an account with that email. Would you like to create one?",
  "email_exists": "An account with this email already exists. Try signing in instead!",
  
  // Registration
  "profile_create_failed": "Something went wrong while setting up your profile. Please try again or contact support if this persists.",
  "otp_expired": "That code has expired. Don’t worry — you can request a new one by clicking the resend button.",
  "invalid_otp": "That code doesn’t match. Please check the digits and try again.",
  
  // System / Network
  "network_error": "We’re having trouble connecting to our servers. Please check your internet connection.",
  "unexpected_error": "Something unexpected happened on our end. We’re working to fix it! Please try again in a moment.",
  
  // Status related
  "suspended": "Your account is currently suspended. If you believe this is a mistake, please reach out to our support team.",
  "pending": "Your application is currently under review by our team. We'll notify you as soon as there’s an update!",
  "rejected": "We're sorry, but your application couldn't be approved at this time.",
  "expired": "Your access has expired. Please contact administration to renew your membership.",
  
  // Specific Login Failures
  "email_not_verified": "Your email is not verified. Please check your inbox for the verification link.",
  "no_account_phone": "No account found with this phone number. Please register first.",
  "no_account_cnic": "No account found with this CNIC. Please register first.",
  "no_account_username": "No account found with this username. Please register first.",
  "account_lookup_failed": "Unable to find your account. Please check your details and try again.",
};

export function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return "";
  
  const errorCode = typeof error === 'string' ? error : ((error as Record<string, unknown>)?.code as string) || ((error as Error)?.message) || "";
  
  // Check for direct matches
  if (FRIENDLY_ERRORS[errorCode]) {
    return FRIENDLY_ERRORS[errorCode];
  }
  
  // Check for common substrings
  const lowerError = errorCode.toLowerCase();
  
  if (lowerError.includes("credentials") || lowerError.includes("invalid email or password")) return FRIENDLY_ERRORS.invalid_credentials;
  if (lowerError.includes("rate limit")) return "You're moving a bit too fast! Please wait a moment before trying again.";
  if (lowerError.includes("network") || lowerError.includes("fetch") || lowerError.includes("unable to connect")) return FRIENDLY_ERRORS.network_error;
  // Only treat a raw message as "invalid OTP" when it *also* suggests the
  // code is wrong/expired. Previously any message containing the substring
  // "code" or "otp" was rewritten, which swallowed helpful server errors
  // like "Unexpected error, please try again later" during OTP flows.
  if (
    (lowerError.includes("otp") || lowerError.includes("code")) &&
    (lowerError.includes("invalid") ||
      lowerError.includes("incorrect") ||
      lowerError.includes("wrong") ||
      lowerError.includes("doesn't match") ||
      lowerError.includes("does not match"))
  ) {
    return FRIENDLY_ERRORS.invalid_otp;
  }
  if (lowerError.includes("suspended")) return FRIENDLY_ERRORS.suspended;
  // The membership-renewal copy must only fire for *account* expiry.
  // Without the "account" / "membership" qualifier this branch also
  // swallowed totally unrelated messages like "Your session has expired"
  // and "Your registration session has expired. Please start fresh." —
  // which is how a user who wasn't even logged in, returning to the
  // register page, saw "Your access has expired. Please contact
  // administration to renew your membership." The server's own copy
  // for OTP/session/registration expiry is already friendly, so we let
  // those fall through to the message text.
  if (
    lowerError.includes("expired") &&
    (lowerError.includes("account") || lowerError.includes("membership"))
  ) {
    return FRIENDLY_ERRORS.expired;
  }
  if (lowerError.includes("verify your email") || lowerError.includes("not verified")) return FRIENDLY_ERRORS.email_not_verified;

  // The "no account found" heuristics below must require BOTH an account-
  // identifier keyword (cnic / username / phone) AND a phrase that clearly
  // indicates the account wasn't found. The previous code translated *any*
  // error text containing the word "cnic" or "username" to the no-account
  // copy, which is why the register page's Stage 2 flashed "No account
  // found with this CNIC. Please register first." whenever the user hit a
  // real Stage-2 failure such as "CNIC already registered" or
  // "Invalid CNIC format (12345-1234567-1)" — exactly the opposite of
  // what the server was saying.
  const looksLikeNoAccount =
    lowerError.includes("no account") ||
    lowerError.includes("not found") ||
    lowerError.includes("please register");

  if (looksLikeNoAccount && lowerError.includes("phone")) return FRIENDLY_ERRORS.no_account_phone;
  if (looksLikeNoAccount && lowerError.includes("cnic")) return FRIENDLY_ERRORS.no_account_cnic;
  if (looksLikeNoAccount && lowerError.includes("username")) return FRIENDLY_ERRORS.no_account_username;

  // Fallback to original message or generic error
  return typeof error === 'string' ? error : ((error as Error)?.message) || FRIENDLY_ERRORS.unexpected_error;
}
