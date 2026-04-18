import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    tenantId?: string;
    tenantSlug?: string;
    classId?: string | null;
    subjectId?: string | null;
    /** SUPER_ADMIN: school tenant to browse (read-only). */
    superViewTenantId?: string | null;
    superViewTenantSlug?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      role: string;
      tenantId: string;
      tenantSlug: string;
      classId?: string | null;
      subjectId?: string | null;
      superViewTenantId?: string | null;
      superViewTenantSlug?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    name?: string | null;
    role?: string;
    id?: string;
    tenantId?: string;
    tenantSlug?: string;
    classId?: string | null;
    subjectId?: string | null;
    superViewTenantId?: string | null;
    superViewTenantSlug?: string | null;
  }
}
