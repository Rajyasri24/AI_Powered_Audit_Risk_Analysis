import { getUserName, getUserRole, ROLES } from "../utils/rbac";

export default function SettingsPage() {
  const roleRows = [
    {
      role: ROLES.ADMIN,
      purpose: "Platform administration and full operational access.",
      access: "All modules; client administration; audit rules; data operations; assessments; reports; settings.",
    },
    {
      role: ROLES.AUDIT_MANAGER,
      purpose: "Review and oversight of audit work.",
      access: "Dashboard, clients, rules (read), datasets (read), assessments (read), findings, reports and Copilot.",
    },
    {
      role: ROLES.AUDITOR,
      purpose: "Day-to-day execution of audit analytics.",
      access: "Dashboard, clients (read), rules, upload, datasets, run assessments, findings, reports and Copilot.",
    },
  ];

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Platform access and role configuration overview.</p>

      <div className="card" style={{ marginTop: "20px" }}>
        <h2 style={{ marginTop: 0 }}>Current Administrator</h2>
        <p><strong>User:</strong> {getUserName()}</p>
        <p><strong>Role:</strong> {getUserRole()}</p>
      </div>

      <div className="card" style={{ marginTop: "20px" }}>
        <h2 style={{ marginTop: 0 }}>RBAC Matrix</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Responsibility</th>
                <th>Application Access</th>
              </tr>
            </thead>
            <tbody>
              {roleRows.map((row) => (
                <tr key={row.role}>
                  <td><strong>{row.role}</strong></td>
                  <td>{row.purpose}</td>
                  <td>{row.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: "14px", marginBottom: 0, color: "#64748B", fontSize: "13px" }}>
          User creation is not exposed through the browser in this version. Accounts are provisioned through the secured Supabase administration environment.
        </p>
      </div>
    </div>
  );
}
