import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

export default function MainLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          AuditRisk AI
          <div className="sidebar-subtitle">Enterprise Risk Intelligence</div>
        </div>

        <nav className="sidebar-nav">
          <NavItem to="/dashboard" label="Dashboard" />
          <NavItem to="/clients" label="Clients" />
          <NavItem to="/rules" label="Rules" />
          <NavItem to="/upload" label="Datasets" />
          <NavItem to="/analysis" label="Analysis" />
          <NavItem to="/investigation" label="Findings" />
          <NavItem to="/reports" label="Reports" />
          <NavItem to="/copilot" label="AI Copilot" />
          <NavItem to="/settings" label="Settings" />
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">AI Audit Risk Analysis Platform</div>
          <div style={{ color: "#6B7280", fontSize: "14px" }}>
            Secure Audit Workspace
          </div>
        </header>

        <section className="workspace">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive ? "sidebar-link active" : "sidebar-link"
      }
    >
      {label}
    </NavLink>
  );
}