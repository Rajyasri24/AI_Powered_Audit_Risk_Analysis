import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../services/supabaseClient";
import {
  cacheVerifiedProfile,
  clearAuthStorage,
  ROLES,
} from "../utils/rbac";

const VALID_ROLES = new Set([
  ROLES.ADMIN,
  ROLES.AUDIT_MANAGER,
  ROLES.AUDITOR,
]);

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setMessage("");

    if (!email || !password) {
      setMessage("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      clearAuthStorage();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data?.session || !data?.user) {
        setMessage("Invalid login details. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, status")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setMessage("Your user profile could not be loaded.");
        return;
      }

      if (profile.status !== "Active") {
        await supabase.auth.signOut();
        setMessage("This account is inactive. Contact the platform administrator.");
        return;
      }

      if (!VALID_ROLES.has(profile.role)) {
        await supabase.auth.signOut();
        setMessage("This account does not have a valid platform role.");
        return;
      }

      await supabase
        .from("profiles")
        .update({
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.user.id);

      cacheVerifiedProfile(profile);
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      setMessage("Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1>AI Audit Risk Analysis Platform</h1>
        <p style={{ color: "#6B7280", lineHeight: 1.5 }}>
          Secure access for authorised audit personnel.
        </p>

        <input
          style={inputStyle}
          placeholder="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleLogin();
          }}
        />

        <input
          style={inputStyle}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleLogin();
          }}
        />

        <button style={primaryButtonStyle} onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>

        <p style={provisionStyle}>
          User accounts and roles are provisioned by the platform administrator.
        </p>

        {message && <p style={messageStyle}>{message}</p>}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#F8F9FC",
};

const cardStyle = {
  width: "420px",
  maxWidth: "calc(100vw - 32px)",
  background: "#FFFFFF",
  borderRadius: "24px",
  padding: "32px",
  boxShadow: "0 20px 50px rgba(15, 16, 21, 0.12)",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  marginBottom: "14px",
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
};

const primaryButtonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  border: "none",
  color: "#FFFFFF",
  fontWeight: "600",
  cursor: "pointer",
  background: "linear-gradient(135deg, #7C3AED, #EC4899)",
};

const provisionStyle = {
  marginTop: "16px",
  marginBottom: 0,
  color: "#9CA3AF",
  fontSize: "12px",
  textAlign: "center",
};

const messageStyle = {
  marginTop: "16px",
  color: "#B91C1C",
};
