import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sessionDisplayName } from "@/lib/user-display";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        tenantSlug: { label: "Site", type: "text" },
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const tenantSlug = (credentials?.tenantSlug as string | undefined)?.trim().toLowerCase();
        const username = (credentials?.username as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;
        if (!tenantSlug || !username || !password) return null;

        const tenant = await prisma.tenant.findFirst({
          where: { slug: tenantSlug, deletedAt: null },
        });
        if (!tenant) return null;

        const user = await prisma.user.findUnique({
          where: {
            tenantId_username: { tenantId: tenant.id, username },
          },
          include: { tenant: true },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: sessionDisplayName(user),
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
        };
      },
    }),
    Credentials({
      id: "volunteer-invite",
      name: "Volunteer invite",
      credentials: {
        token: { label: "Token", type: "text" },
        passcode: { label: "Passcode", type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.token as string | undefined;
        const passcode = credentials?.passcode as string | undefined;
        if (!token?.trim() || !passcode?.trim()) return null;

        const invite = await prisma.volunteerInvite.findUnique({
          where: { token: token.trim() },
        });
        if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
          return null;
        }

        const passOk = await bcrypt.compare(passcode.trim(), invite.passcodeHash);
        if (!passOk) return null;

        const marked = await prisma.volunteerInvite.updateMany({
          where: { id: invite.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (marked.count !== 1) return null;

        const label = invite.volunteerLabel?.trim();
        if (label) {
          await prisma.user.update({
            where: { id: invite.userId },
            data: { displayName: label.slice(0, 80) },
          });
        }

        const user = await prisma.user.findUnique({
          where: { id: invite.userId },
          include: { tenant: true },
        });
        if (!user || user.role !== "VOLUNTEER" || !user.tenant || user.tenant.deletedAt) {
          return null;
        }

        return {
          id: user.id,
          name: sessionDisplayName(user),
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
        };
      },
    }),
    Credentials({
      id: "super-admin",
      name: "Super admin",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = (credentials?.username as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        const user = await prisma.user.findFirst({
          where: {
            username,
            role: "SUPER_ADMIN",
            tenant: { isPlatform: true, deletedAt: null },
          },
          include: { tenant: true },
        });
        if (!user?.tenant) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: sessionDisplayName(user),
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.name = user.name;
        token.role = user.role;
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.tenantSlug = user.tenantSlug;
        token.classId = user.classId ?? null;
        token.subjectId = user.subjectId ?? null;
        token.superViewTenantId =
          user.role === "SUPER_ADMIN" ? (user.superViewTenantId ?? null) : null;
        token.superViewTenantSlug =
          user.role === "SUPER_ADMIN" ? (user.superViewTenantSlug ?? null) : null;
      }
      if (trigger === "update" && session) {
        const s = session as {
          classId?: string | null;
          subjectId?: string | null;
          superViewTenantId?: string | null;
          superViewTenantSlug?: string | null;
        };
        if ("classId" in s) token.classId = s.classId;
        if ("subjectId" in s) token.subjectId = s.subjectId;
        if (token.role === "SUPER_ADMIN") {
          if ("superViewTenantId" in s) token.superViewTenantId = s.superViewTenantId;
          if ("superViewTenantSlug" in s) token.superViewTenantSlug = s.superViewTenantSlug;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.name === "string" && token.name) {
          session.user.name = token.name;
        }
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.tenantSlug = token.tenantSlug as string;
        session.user.classId =
          typeof token.classId === "string" ? token.classId : undefined;
        session.user.subjectId =
          typeof token.subjectId === "string" ? token.subjectId : undefined;
        session.user.superViewTenantId =
          typeof token.superViewTenantId === "string" ? token.superViewTenantId : undefined;
        session.user.superViewTenantSlug =
          typeof token.superViewTenantSlug === "string" ? token.superViewTenantSlug : undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
