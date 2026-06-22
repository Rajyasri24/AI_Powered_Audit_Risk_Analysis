import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../services/supabaseClient";

export default function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("Auditor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isStrongPassword = (passwordValue) => {
    return (
      passwordValue.length >= 8 &&
      /[A-Z]/.test(passwordValue) &&
      /[a-z]/.test(passwordValue) &&
      /[0-9]/.test(passwordValue) &&
      /[^A-Za-z0-9]/.test(passwordValue)
    );
  };

  const handleLogin = async () => {
    setMessage("");

    if (!email || !password) {
      setMessage("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage("Invalid login details. Please try again.");
        return;
      }

      if (data?.session) {
        await supabase
          .from("profiles")
          .update({
            last_login_at: new Date().toISOString(),
          })
          .eq("id", data.user.id);

        navigate("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setMessage("");

    if (!fullName || !email || !password || !role) {
      setMessage("Please fill all fields.");
      return;
    }

    if (!isStrongPassword(password)) {
      setMessage(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      );
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
        },
      });

      if (error) {
        setMessage("This account may already exist. Please use login.");
        return;
      }

      if (data?.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          role,
          status: "Active",
          updated_at: new Date().toISOString(),
        });

        setMessage("Registration successful. Please login now.");
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1>AI Audit Risk Analysis Platform</h1>
        <p style={{ color: "#6B7280" }}>
          Secure access for auditors, managers, compliance teams, and admins.
        </p>

        <div style={tabContainerStyle}>
          <button
            style={mode === "login" ? activeTabStyle : tabStyle}
            onClick={() => setMode("login")}
          >
            Login
          </button>

          <button
            style={mode === "register" ? activeTabStyle : tabStyle}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        {mode === "register" && (
          <>
            <input
              style={inputStyle}
              placeholder="Full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />

            <select
              style={inputStyle}
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="Auditor">Auditor</option>
              <option value="Audit Manager">Audit Manager</option>
              <option value="Compliance Officer">Compliance Officer</option>
              <option value="Admin">Admin</option>
            </select>
          </>
        )}

        <input
          style={inputStyle}
          placeholder="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button
          style={primaryButtonStyle}
          onClick={mode === "login" ? handleLogin : handleRegister}
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Login"
            : "Create Account"}
        </button>

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
  background: "#FFFFFF",
  borderRadius: "24px",
  padding: "32px",
  boxShadow: "0 20px 50px rgba(15, 16, 21, 0.12)",
};

const tabContainerStyle = {
  display: "flex",
  gap: "10px",
  margin: "24px 0",
};

const tabStyle = {
  flex: 1,
  padding: "10px",
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  cursor: "pointer",
};

const activeTabStyle = {
  ...tabStyle,
  background: "linear-gradient(135deg, #7C3AED, #EC4899)",
  color: "#FFFFFF",
  border: "none",
};

const inputStyle = {
  width: "100%",
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

const messageStyle = {
  marginTop: "16px",
  color: "#6B7280",
};