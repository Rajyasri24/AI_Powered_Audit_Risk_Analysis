import { Link, Outlet, useNavigate } from "react-router-dom";

import { supabase } from "../services/supabaseClient";

export default function MainLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div>
      <nav style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>
        <Link to="/dashboard">Dashboard</Link> |{" "}
        <Link to="/clients">Clients</Link> |{" "}
        <Link to="/upload">Upload</Link> |{" "}
        <Link to="/rules">Rules</Link> |{" "}
        <Link to="/analysis">Analysis</Link> |{" "}
        <Link to="/investigation">Findings</Link> |{" "}
        <Link to="/reports">Reports</Link> |{" "}
        <Link to="/copilot">Copilot</Link> |{" "}

        <button onClick={handleLogout}>
          Logout
        </button>
      </nav>

      <div style={{ padding: "20px" }}>
        <Outlet />
      </div>
    </div>
  );
}