export const ROLES = {
  ADMIN: "Admin",
  AUDIT_MANAGER: "Audit Manager",
  AUDITOR: "Auditor",
};

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    dashboard: true, clients: true, rules: true, upload: true,
    datasets: true, analysis: true, findings: true, reports: true,
    copilot: true, settings: true,
    manageClients: true, manageRules: true, uploadData: true,
    runAnalysis: true, deleteData: true, manageUsers: true,
  },
  [ROLES.AUDIT_MANAGER]: {
    dashboard: true, clients: true, rules: true, upload: false,
    datasets: true, analysis: true, findings: true, reports: true,
    copilot: true, settings: false,
    manageClients: false, manageRules: false, uploadData: false,
    runAnalysis: false, deleteData: false, manageUsers: false,
  },
  [ROLES.AUDITOR]: {
    dashboard: true, clients: true, rules: true, upload: true,
    datasets: true, analysis: true, findings: true, reports: true,
    copilot: true, settings: false,
    manageClients: false, manageRules: true, uploadData: true,
    runAnalysis: true, deleteData: true, manageUsers: false,
  },
};

export const getUserRole = () => localStorage.getItem("user_role") || "";
export const getUserName = () => localStorage.getItem("user_name") || "User";

export const canAccess = (role, allowedRoles = []) => {
  if (!role) return false;
  if (allowedRoles.length === 0) return true;
  return allowedRoles.includes(role);
};

export const hasPermission = (permissionKey, role = getUserRole()) =>
  ROLE_PERMISSIONS[role]?.[permissionKey] === true;

export const canViewMenu = (menuKey) => hasPermission(menuKey);

export const cacheVerifiedProfile = ({ id, full_name, role }) => {
  if (id) localStorage.setItem("user_id", String(id));
  localStorage.setItem("user_name", full_name || "User");
  localStorage.setItem("user_role", role || "");
};

export const clearAuthStorage = () => {
  localStorage.removeItem("user_role");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_id");
};
