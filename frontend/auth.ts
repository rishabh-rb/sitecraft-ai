import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      turnstileToken: { label: "Security check", type: "text" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password || !credentials.turnstileToken) return null;
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sitecraft-internal": process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "sitecraft-development-secret-change-me"
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          turnstileToken: credentials.turnstileToken
        })
      });
      if (!response.ok) return null;
      const result = (await response.json()) as { data?: { id: string; name?: string; email: string; role: string; accessToken?: string } };
      if (!result.data) return null;
      return result.data;
    }
  })
];

providers.push(
  CredentialsProvider({
    id: "otp",
    name: "Email verification code",
    credentials: {
      challengeId: { label: "Challenge", type: "text" },
      otp: { label: "Verification code", type: "text" }
    },
    async authorize(credentials) {
      if (!credentials?.challengeId || !credentials.otp) return null;
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/auth/google/verify-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: credentials.challengeId, otp: credentials.otp })
      });
      if (!response.ok) return null;
      const result = (await response.json()) as { data?: { id: string; name?: string; email: string; role: string; image?: string; accessToken?: string } };
      return result.data ?? null;
    }
  })
);

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  pages: {
    signIn: "/login"
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/auth/google/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sitecraft-internal": process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "sitecraft-development-secret-change-me"
        },
        body: JSON.stringify({ email: user.email, name: user.name, image: user.image })
      });
      if (!response.ok) return false;
      const result = (await response.json()) as { data?: { id: string; role: string; accessToken?: string } };
      if (!result.data) return false;
      (user as { id?: string; role?: string }).id = result.data.id;
      (user as { id?: string; role?: string }).role = result.data.role;
      (user as { accessToken?: string }).accessToken = result.data.accessToken;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          role: (user as { role?: string }).role ?? token.role,
          accessToken: (user as { accessToken?: string }).accessToken ?? token.accessToken
        };
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          role: token.role as string | undefined,
          accessToken: token.accessToken
        }
      };
    }
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === "development" ? "sitecraft-development-secret-change-me" : undefined)
};
