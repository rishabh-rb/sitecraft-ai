import {
  createHash,
  randomInt,
  randomUUID,
  timingSafeEqual
} from "node:crypto";

import nodemailer from "nodemailer";

import {
  consumeOtpChallenge,
  getLatestOtpChallenge,
  getUserForAuth,
  incrementOtpAttempts,
  upsertGoogleUser
} from "./store.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[char];
  });
}

function hashOtp(challengeId: string, otp: string): Buffer {
  return createHash("sha256")
    .update(`${challengeId}:${otp}:${process.env.AUTH_SECRET || ""}`)
    .digest();
}

function mailer() {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

  if (!user || !password) {
    throw new Error("Gmail SMTP is not configured.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass: password
    }
  });
}

async function sendOtpEmail(
  email: string,
  otp: string,
  name?: string | null
) {
  const sender = process.env.GMAIL_USER;
  const safeName = name ? escapeHtml(name) : "";
  const greeting = safeName ? `Hello ${safeName},` : "Hello,";
  const textGreeting = name ? `Hello ${name},` : "Hello,";

  await mailer().sendMail({
    from: `"SiteCraft AI" <${sender}>`,
    to: email,
    subject: `${otp} is your SiteCraft AI verification code`,
    text: `
${textGreeting}

Welcome to SiteCraft AI!

To securely continue, use the verification code below.

Your verification code: ${otp}

This code expires in 5 minutes.

For your security, never share this code with anyone. Our team will never ask you to share your verification code.

If you did not request this code, you can safely ignore this email.

Best regards,
The SiteCraft AI Team

© ${new Date().getFullYear()} SiteCraft AI
    `.trim(),
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Verify Your Email - SiteCraft AI</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;padding:40px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#111827;padding:30px 24px;text-align:center;">
          <div style="color:#ffffff;font-size:27px;font-weight:bold;letter-spacing:-0.7px;">SiteCraft <span style="color:#818cf8;">AI</span></div>
          <p style="margin:10px 0 0;color:#cbd5e1;font-size:13px;line-height:1.6;">Create something extraordinary.</p>
        </td></tr>
        <tr><td style="padding:36px 30px 28px;">
          <h1 style="margin:0 0 20px;color:#111827;font-size:25px;line-height:1.4;font-weight:700;">Verify your email address</h1>
          <p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.8;">${greeting}</p>
          <p style="margin:0 0 26px;color:#4b5563;font-size:15px;line-height:1.8;">Welcome to SiteCraft AI! We're glad you're here. To securely continue, please enter the verification code below.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td align="center" style="background-color:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:26px 12px;">
              <p style="margin:0 0 14px;color:#6b7280;font-size:11px;font-weight:bold;letter-spacing:2px;">YOUR VERIFICATION CODE</p>
              <div style="color:#4f46e5;font-size:36px;line-height:1.4;font-weight:bold;letter-spacing:8px;padding-left:8px;">${otp}</div>
              <p style="margin:14px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">This code expires in <strong style="color:#374151;">5 minutes</strong>.</p>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:25px;">
            <tr><td style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:15px 16px;">
              <p style="margin:0;color:#92400e;font-size:13px;line-height:1.8;"><strong>Security reminder</strong><br>Never share this code with anyone. SiteCraft AI will never ask you to disclose your verification code.</p>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.8;">Didn't request this verification code? No action is needed. You can safely ignore this email.</p>
          <p style="margin:28px 0 0;color:#374151;font-size:14px;line-height:1.8;">Best regards,<br><strong style="color:#111827;">The SiteCraft AI Team</strong></p>
        </td></tr>
        <tr><td align="center" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:24px;">
          <p style="margin:0 0 10px;color:#6b7280;font-size:12px;line-height:1.7;">This is an automated security email. Please do not reply to this message.</p>
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.7;">&copy; ${new Date().getFullYear()} SiteCraft AI. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `
  });
}

export async function createGoogleOtpChallenge(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  providerId?: string;
}) {
  const id = randomUUID();
  const otp = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const challenge = await upsertGoogleUser({
    id,
    email: input.email,
    name: input.name ?? null,
    image: input.image ?? null,
    providerId: input.providerId ?? null,
    codeHash: hashOtp(id, otp).toString("hex"),
    expiresAt
  });

  try {
    await sendOtpEmail(input.email, otp, input.name);
  } catch (error) {
    console.error("OTP email delivery failed:", error);
    throw new Error("Unable to send the verification email. Please try again.");
  }

  return { challengeId: challenge.id, email: challenge.email };
}

export async function createEmailOtpChallenge(email: string) {
  return createGoogleOtpChallenge({ email });
}

export async function resendOtpChallenge(challengeId: string) {
  const challenge = await getUserForAuth(challengeId);
  if (!challenge || challenge.consumedAt) {
    throw new Error("This verification request is no longer available. Start again.");
  }

  return createGoogleOtpChallenge({
    email: challenge.email,
    name: challenge.name,
    image: challenge.image,
    providerId: challenge.providerId ?? undefined
  });
}

export async function verifyGoogleOtp(challengeId: string, otp: string) {
  const requestedChallenge = await getUserForAuth(challengeId);
  const latestChallenge = requestedChallenge
    ? await getLatestOtpChallenge(requestedChallenge.email)
    : undefined;
  const challenges = [requestedChallenge, latestChallenge].filter(
    (challenge, index, all): challenge is NonNullable<typeof challenge> =>
      Boolean(challenge) && all.findIndex((candidate) => candidate?.id === challenge?.id) === index
  );
  const activeChallenges = challenges.filter((candidate) => (
    !candidate.consumedAt &&
    candidate.expiresAt.getTime() > Date.now() &&
    candidate.attempts < MAX_ATTEMPTS
  ));

  if (activeChallenges.length === 0) {
    throw new Error("This verification code has expired or is invalid.");
  }

  if (!/^\d{6}$/.test(otp)) {
    const recorded = await incrementOtpAttempts(activeChallenges[0].id, MAX_ATTEMPTS);
    if (!recorded) {
      throw new Error("Too many verification attempts. Start again.");
    }
    throw new Error("Incorrect verification code.");
  }

  const challenge = activeChallenges.find((candidate) => {
    const expected = Buffer.from(candidate.codeHash, "hex");
    const actual = hashOtp(candidate.id, otp);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  });
  if (!challenge) {
    const recorded = await incrementOtpAttempts(activeChallenges[0].id, MAX_ATTEMPTS);
    if (!recorded) {
      throw new Error("Too many verification attempts. Start again.");
    }
    throw new Error("Incorrect verification code.");
  }

  const user = await consumeOtpChallenge(challenge.id);
  if (!user) {
    throw new Error("This verification code is no longer available.");
  }

  return user;
}
