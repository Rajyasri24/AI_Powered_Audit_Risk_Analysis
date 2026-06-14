import { Link, Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div>
      <nav style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>
        <Link to="/dashboard">Dashboard</Link> |{" "}
        <Link to="/clients">Clients</Link> |{" "}
        <Link to="/upload">Upload</Link> |{" "}
        <Link to="/rules">Rules</Link> |{" "}
        <Link to="/analysis">Analysis</Link> |{" "}
        <Link to="/reports">Reports</Link> |{" "}
        <Link to="/copilot">Copilot</Link>
      </nav>

      <div style={{ padding: "20px" }}>
        <Outlet />
      </div>
    </div>
  );
}