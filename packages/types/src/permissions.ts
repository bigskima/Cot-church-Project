export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  is_system: boolean;
  role_permissions: Array<{ permission_code: string }>;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
  permissionCodes: string[];
}

export interface UpdateRoleRequest extends Omit<CreateRoleRequest, "code"> {
  roleId: string;
}

export interface AssignRoleRequest {
  membershipId: string;
  roleId: string;
  branchId?: string;
  expiresAt?: string;
}

export interface RoleAssignmentRecord {
  id: string;
  membership_id: string;
  branch_id: string | null;
  expires_at: string | null;
  role: { id: string; code: string; name: string; is_system: boolean };
}
