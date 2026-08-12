import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { supabase } from "../services/supabaseClient";
import {
  canViewMenu,
  clearAuthStorage,
  getUserName,
  getUserRole,
} from "../utils/rbac";

const MENU_ITEMS = [
  { key: "dashboard", to: "/dashboard", label: "Dashboard", icon: "▦" },
  { key: "clients", to: "/clients", label: "Clients", icon: "◉" },
  { key: "rules", to: "/rules", label: "Rules", icon: "✓" },
  { key: "upload", to: "/upload", label: "Upload", icon: "↑" },
  { key: "datasets", to: "/datasets", label: "Datasets", icon: "▤" },
  { key: "analysis", to: "/analysis", label: "Analysis", icon: "◆" },
  { key: "findings", to: "/investigation", label: "Findings", icon: "!" },
  { key: "reports", to: "/reports", label: "Reports", icon: "▧" },
  { key: "copilot", to: "/copilot", label: "AI Copilot", icon: "✦" },
  { key: "settings", to: "/settings", label: "Settings", icon: "⚙" },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true"
  );
  const [userName, setUserName] = useState(getUserName());
  const [userRole, setUserRole] = useState(getUserRole());

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    setUserName(getUserName());
    setUserRole(getUserRole());
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearAuthStorage();
    navigate("/");
  };

  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-is-collapsed" : "app-shell"}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand-wrap">
            <div className="sidebar-logo">A</div>
            {!sidebarCollapsed && (
              <div>
                <div className="sidebar-brand">AuditRisk AI</div>
                <div className="sidebar-subtitle">Enterprise Risk Intelligence</div>
              </div>
            )}
          </div>
        </div>

        {!sidebarCollapsed && (
          <div className="sidebar-user-card">
            <strong>{userName}</strong>
            <span>{userRole}</span>
          </div>
        )}

        <nav className="sidebar-nav">
          {MENU_ITEMS.filter((item) => canViewMenu(item.key)).map((item) => (
            <NavItem
              key={item.key}
              to={item.to}
              label={item.label}
              icon={item.icon}
              collapsed={sidebarCollapsed}
            />
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="logout-btn"
            title={sidebarCollapsed ? "Logout" : undefined}
            onClick={handleLogout}
          >
            <span className="sidebar-link-icon">↪</span>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed((current) => !current)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? "☰" : "‹"}
            </button>
            <div className="topbar-title">AI Audit Risk Analysis Platform</div>
          </div>
          <div className="topbar-workspace-label">Secure Audit Workspace</div>
        </header>

        <section className="workspace">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

function NavItem({ to, label, icon, collapsed }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        isActive ? "sidebar-link active" : "sidebar-link"
      }
    >
      <span className="sidebar-link-icon">{icon}</span>
      {!collapsed && <span className="sidebar-link-label">{label}</span>}
    </NavLink>
  );
}
