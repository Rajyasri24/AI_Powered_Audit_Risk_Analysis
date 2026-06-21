import { Link } from "react-router-dom";

export default function LoginPage() {
  return (
    <div style={{ padding: "40px" }}>
      <h1>AI Audit Risk Analysis Platform</h1>
      <p>Login page placeholder. Authentication will be added later.</p>

      <Link to="/dashboard">
        Enter Dashboard
      </Link>
    </div>
  );
}