import { API } from './endpoints';
import { apiGet, apiPost, apiPut, qs } from './client';
import type { EmployeeDTO, RoleDTO, CreateEmployeeRequest } from '@/types';

export const expertsApi = {
  listEmployees: (signal?: AbortSignal) =>
    apiGet<EmployeeDTO[]>(API.admin.employees, { signal }),

  listAvailable: (signal?: AbortSignal) =>
    apiGet<EmployeeDTO[]>(API.admin.availableExperts, { signal }),

  listRoles: (signal?: AbortSignal) => apiGet<RoleDTO[]>(API.admin.roles, { signal }),

  setActive: (employeeId: number, active: boolean) =>
    apiPost<unknown>(`${API.admin.employeeStatus(employeeId)}${qs({ active })}`),

  /** POST /admin/employee/{id}/role?roleName= — query param, NOT a JSON body. */
  setRole: (employeeId: number, roleName: string) =>
    apiPost<unknown>(`${API.admin.employeeRole(employeeId)}${qs({ roleName })}`),

  /**
   * PUT /admin/roles/{roleId}/permissions — keyed on the ROLE, not the employee.
   *
   * The body is a BARE ARRAY of permission strings. Wrapping it as
   * `{ permissions }` deserialises to an empty list server-side, which silently
   * strips every permission from the role instead of saving them.
   */
  setRolePermissions: (roleId: number, permissions: string[]) =>
    apiPut<unknown>(API.admin.rolePermissions(roleId), permissions),

  /**
   * POST /admin/roles — body { name, permissions }. Used when a role has never
   * been seeded, so there is no id to PUT against yet.
   */
  createRole: (name: string, permissions: string[]) =>
    apiPost<RoleDTO>(API.admin.roles, { name, permissions }),

  /**
   * POST /emp/create — QUERY PARAMS, not a body. Sending JSON here silently
   * fails: the controller binds @RequestParam, so every field arrives null.
   *
   * SECURITY NOTE: this puts the password in the URL, where it is captured by
   * server access logs, proxies and browser history. That is the existing
   * backend contract and cannot be changed from the frontend — but it should
   * be moved to a request body server-side. See ADD-EXPERT.md.
   */
  create: ({ name, email, password, role, managerId }: CreateEmployeeRequest) =>
    apiPost<EmployeeDTO>(
      `${API.admin.createEmployee}${qs({
        name,
        email,
        password,
        role,
        // Omitted entirely when blank — qs() drops empty values.
        managerId: managerId?.trim() || undefined,
      })}`
    ),
};
