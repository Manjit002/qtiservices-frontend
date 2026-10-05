import type { UserRole } from './auth';

export type AvailabilityStatus =
  | 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'ON_LEAVE' | (string & {});

export interface EmployeeDTO {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: UserRole | null;
  active?: boolean | null;
  availabilityStatus?: AvailabilityStatus | null;
  phone?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
}

/**
 * POST /emp/create takes these as QUERY PARAMETERS, not a JSON body.
 * `managerId` is omitted entirely when blank — the source only appends it when
 * non-empty, and sending an empty value is not the same as omitting it.
 */
export interface CreateEmployeeRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  managerId?: string;
}

/** Roles the admin form offers. Copied verbatim from the source's select. */
export const CREATABLE_ROLES = ['EXPERT', 'ADMIN', 'SUPER_ADMIN'] as const;

/** Backend minimum, enforced client-side so the error is immediate. */
export const MIN_PASSWORD_LENGTH = 6;

export interface RoleDTO {
  id?: number;
  name: string;
  permissions?: string[];
}

export interface PermissionDTO {
  id?: number;
  name: string;
  enabled?: boolean;
}

/** The complete permission vocabulary, copied verbatim from the source. */
export const ALL_PERMISSIONS = [
  'CREATE_ORDER', 'VIEW_ORDER', 'VIEW_ALL_ORDERS', 'ASSIGN_ORDER', 'UPDATE_ORDER',
  'DELETE_ORDER', 'MANAGE_USERS', 'VIEW_USERS', 'UPLOAD_FILE', 'DOWNLOAD_FILE',
  'MAKE_PAYMENT', 'VIEW_PAYMENTS', 'CHAT_ACCESS', 'SUPER_ADMIN_ACCESS',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

/** Human labels, copied verbatim from the source's PERM_LABELS map. */
export const PERMISSION_LABEL: Record<string, string> = {
  CREATE_ORDER: 'Create order', VIEW_ORDER: 'View order',
  VIEW_ALL_ORDERS: 'View all orders', ASSIGN_ORDER: 'Assign order',
  UPDATE_ORDER: 'Update order', DELETE_ORDER: 'Delete order',
  MANAGE_USERS: 'Manage users', VIEW_USERS: 'View users',
  UPLOAD_FILE: 'Upload file', DOWNLOAD_FILE: 'Download file',
  MAKE_PAYMENT: 'Make payment', VIEW_PAYMENTS: 'View payments',
  CHAT_ACCESS: 'Chat access', SUPER_ADMIN_ACCESS: 'Super admin access',
};

/** Roles the assignment dropdown offers — the three from the source's select. */
export const ASSIGNABLE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EXPERT'] as const;

/**
 * What each role does day to day. Descriptive only — the authoritative access
 * for a role is its permission list from GET /admin/roles, shown alongside.
 */
export const ROLE_SUMMARY: Record<string, string> = {
  SUPER_ADMIN: 'Full platform access, including role management, deleted-order history and revenue figures.',
  ADMIN: 'Runs day-to-day operations: assigns orders, manages experts and students, handles payments.',
  EXPERT: 'Works assigned orders, uploads deliverables and talks to students in chat.',
};
