import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../services/supabaseClient";
import {
  cacheVerifiedProfile,
  clearAuthStorage,
  ROLES,
} from "../utils/rbac";

const VALID_LOGIN_ROLES = new Set([
  ROLES.ADMIN,
  ROLES.AUDIT_MANAGER,
  ROLES.AUDITOR,
]);

const PUBLIC_REGISTRATION_ROLES = [
  ROLES.AUDITOR,
  ROLES.AUDIT_MANAGER,
];

export default function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState(ROLES.AUDITOR);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [loading, setLoading] = useState(false);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 10,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9\s]/.test(password),
      noWhitespace: !/\s/.test(password),
    }),
    [password]
  );

  const strongPassword = Object.values(
    passwordChecks
  ).every(Boolean);

  const resetFeedback = () => {
    setMessage("");
    setMessageType("error");
  };

  const switchMode = (nextMode) => {
    resetFeedback();
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
  };

  const isValidEmail = (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value
    );

  const handleLogin = async () => {
    resetFeedback();

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    if (
      !normalizedEmail
      || !password
    ) {
      setMessage(
        "Please enter email and password."
      );
      return;
    }

    if (
      !isValidEmail(
        normalizedEmail
      )
    ) {
      setMessage(
        "Please enter a valid email address."
      );
      return;
    }

    try {
      setLoading(true);
      clearAuthStorage();

      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (
        error
        || !data?.session
        || !data?.user
      ) {
        setMessage(
          "Invalid login details. Please try again."
        );
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, status"
        )
        .eq("id", data.user.id)
        .single();

      if (
        profileError
        || !profile
      ) {
        await supabase.auth.signOut();
        setMessage(
          "Your user profile could not be loaded."
        );
        return;
      }

      if (
        profile.status !==
        "Active"
      ) {
        await supabase.auth.signOut();
        setMessage(
          "This account is inactive. Contact the platform administrator."
        );
        return;
      }

      if (
        !VALID_LOGIN_ROLES.has(
          profile.role
        )
      ) {
        await supabase.auth.signOut();
        setMessage(
          "This account does not have a valid platform role."
        );
        return;
      }

      await supabase
        .from("profiles")
        .update({
          last_login_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          data.user.id
        );

      cacheVerifiedProfile(
        profile
      );

      navigate(
        "/dashboard"
      );
    } catch (error) {
      console.error(error);
      setMessage(
        "Unable to sign in right now."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    resetFeedback();

    const normalizedName =
      fullName.trim();

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (
      normalizedName.length < 2
      || normalizedName.length > 80
    ) {
      setMessage(
        "Full name must contain between 2 and 80 characters."
      );
      return;
    }

    if (
      !/^[A-Za-z][A-Za-z .'-]*$/.test(
        normalizedName
      )
    ) {
      setMessage(
        "Full name contains unsupported characters."
      );
      return;
    }

    if (
      !PUBLIC_REGISTRATION_ROLES.includes(
        role
      )
    ) {
      setMessage(
        "Select a valid registration role."
      );
      return;
    }

    if (
      !isValidEmail(
        normalizedEmail
      )
    ) {
      setMessage(
        "Please enter a valid email address."
      );
      return;
    }

    if (
      !strongPassword
    ) {
      setMessage(
        "Password does not meet the security requirements."
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setMessage(
        "Passwords do not match."
      );
      return;
    }

    const emailUsername =
      normalizedEmail
        .split("@")[0]
        .toLowerCase();

    if (
      emailUsername.length >= 4
      && password
        .toLowerCase()
        .includes(
          emailUsername
        )
    ) {
      setMessage(
        "Password should not contain your email username."
      );
      return;
    }

    try {
      setLoading(true);

      const {
        data,
        error,
      } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo:
              window.location.origin,
            data: {
              full_name:
                normalizedName,
              requested_role:
                role,
            },
          },
        });

      if (error) {
        const errorText =
          String(
            error.message || ""
          ).toLowerCase();

        if (
          errorText.includes(
            "registered"
          )
          || errorText.includes(
            "already"
          )
        ) {
          setMessage(
            "An account with this email may already exist. Try logging in."
          );
        } else if (
          errorText.includes(
            "password"
          )
        ) {
          setMessage(
            "The password was rejected. Choose a stronger password."
          );
        } else {
          setMessage(
            "Unable to create the account. Please check your details and try again."
          );
        }

        return;
      }

      if (
        !data?.user
      ) {
        setMessage(
          "Unable to create the account."
        );
        return;
      }

      /*
        IMPORTANT:
        The matching profiles row is created by the one-time
        Supabase Auth trigger described in the deployment steps.
        That trigger also prevents public Admin registration.
      */

      if (
        data.session
      ) {
        await supabase.auth.signOut();

        setMessageType(
          "success"
        );
        setMessage(
          "Account created successfully. Please log in."
        );
      } else {
        setMessageType(
          "success"
        );
        setMessage(
          "Account created. Check your email to confirm the account, then log in."
        );
      }

      setMode(
        "login"
      );

      setFullName("");
      setRole(
        ROLES.AUDITOR
      );
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      setMessage(
        "Unable to create the account right now."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (
    event
  ) => {
    event.preventDefault();

    if (
      loading
    ) {
      return;
    }

    if (
      mode === "login"
    ) {
      handleLogin();
    } else {
      handleRegister();
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>
          AI Audit Risk Analysis Platform
        </h1>

        <p style={subtitleStyle}>
          Secure access for authorised
          audit personnel.
        </p>

        <div style={tabsStyle}>
          <button
            type="button"
            style={
              mode === "login"
                ? activeTabStyle
                : tabStyle
            }
            onClick={() =>
              switchMode(
                "login"
              )
            }
          >
            Login
          </button>

          <button
            type="button"
            style={
              mode === "register"
                ? activeTabStyle
                : tabStyle
            }
            onClick={() =>
              switchMode(
                "register"
              )
            }
          >
            Register
          </button>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
        >
          {mode ===
            "register" && (
            <>
              <label style={labelStyle}>
                Full Name
              </label>

              <input
                style={inputStyle}
                placeholder="Full name"
                value={fullName}
                maxLength={80}
                autoComplete="name"
                onChange={(
                  event
                ) =>
                  setFullName(
                    event.target.value
                  )
                }
              />

              <label style={labelStyle}>
                Role
              </label>

              <select
                style={inputStyle}
                value={role}
                onChange={(
                  event
                ) =>
                  setRole(
                    event.target.value
                  )
                }
              >
                <option
                  value={
                    ROLES.AUDITOR
                  }
                >
                  Auditor
                </option>

                <option
                  value={
                    ROLES.AUDIT_MANAGER
                  }
                >
                  Audit Manager
                </option>
              </select>

              <p style={helperStyle}>
                Administrator accounts
                are not available through
                public registration.
              </p>
            </>
          )}

          <label style={labelStyle}>
            Email
          </label>

          <input
            style={inputStyle}
            placeholder="Email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(
              event
            ) =>
              setEmail(
                event.target.value
              )
            }
          />

          <label style={labelStyle}>
            Password
          </label>

          <div style={passwordWrapStyle}>
            <input
              style={passwordInputStyle}
              placeholder="Password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              value={password}
              onChange={(
                event
              ) =>
                setPassword(
                  event.target.value
                )
              }
            />

            <button
              type="button"
              style={showButtonStyle}
              onClick={() =>
                setShowPassword(
                  (current) =>
                    !current
                )
              }
            >
              {showPassword
                ? "Hide"
                : "Show"}
            </button>
          </div>

          {mode ===
            "register" && (
            <>
              <div style={checklistStyle}>
                <strong>
                  Password requirements
                </strong>

                <div style={checkGridStyle}>
                  {[
                    [
                      "10+ characters",
                      passwordChecks.length,
                    ],
                    [
                      "Uppercase",
                      passwordChecks.uppercase,
                    ],
                    [
                      "Lowercase",
                      passwordChecks.lowercase,
                    ],
                    [
                      "Number",
                      passwordChecks.number,
                    ],
                    [
                      "Special character",
                      passwordChecks.special,
                    ],
                    [
                      "No spaces",
                      passwordChecks.noWhitespace,
                    ],
                  ].map(
                    ([
                      label,
                      passed,
                    ]) => (
                      <span
                        key={label}
                        style={{
                          color:
                            passed
                              ? "#166534"
                              : "#6B7280",
                        }}
                      >
                        {passed
                          ? "✓"
                          : "•"}{" "}
                        {label}
                      </span>
                    )
                  )}
                </div>
              </div>

              <label style={labelStyle}>
                Confirm Password
              </label>

              <input
                style={inputStyle}
                placeholder="Confirm password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                value={
                  confirmPassword
                }
                onChange={(
                  event
                ) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
              />
            </>
          )}

          <button
            style={
              loading
                ? {
                    ...primaryButtonStyle,
                    opacity: 0.65,
                    cursor:
                      "not-allowed",
                  }
                : primaryButtonStyle
            }
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode ===
                  "login"
              ? "Login"
              : "Create Account"}
          </button>
        </form>

        {message && (
          <p
            style={
              messageType ===
              "success"
                ? successMessageStyle
                : messageStyle
            }
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg, #F8F9FC 0%, #F5F3FF 100%)",
  padding: "24px",
};

const cardStyle = {
  width: "440px",
  maxWidth:
    "calc(100vw - 32px)",
  background: "#FFFFFF",
  borderRadius: "24px",
  padding: "32px",
  boxShadow:
    "0 20px 50px rgba(15, 16, 21, 0.12)",
};

const titleStyle = {
  marginTop: 0,
  marginBottom: "8px",
};

const subtitleStyle = {
  color: "#6B7280",
  lineHeight: 1.5,
  marginBottom: "20px",
};

const tabsStyle = {
  display: "flex",
  gap: "8px",
  marginBottom: "20px",
  padding: "5px",
  borderRadius: "12px",
  background: "#F8FAFC",
};

const tabStyle = {
  flex: 1,
  border: "none",
  borderRadius: "9px",
  padding: "10px",
  background: "transparent",
  color: "#6B7280",
  fontWeight: "700",
  cursor: "pointer",
};

const activeTabStyle = {
  ...tabStyle,
  background: "#FFFFFF",
  color: "#6D28D9",
  boxShadow:
    "0 2px 8px rgba(15, 23, 42, 0.08)",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#374151",
  fontSize: "12px",
  fontWeight: "700",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  marginBottom: "14px",
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
};

const passwordWrapStyle = {
  position: "relative",
  marginBottom: "14px",
};

const passwordInputStyle = {
  ...inputStyle,
  marginBottom: 0,
  paddingRight: "65px",
};

const showButtonStyle = {
  position: "absolute",
  top: "50%",
  right: "8px",
  transform:
    "translateY(-50%)",
  border: "none",
  background: "transparent",
  color: "#6D28D9",
  fontWeight: "700",
  cursor: "pointer",
};

const helperStyle = {
  marginTop: "-7px",
  marginBottom: "14px",
  color: "#9CA3AF",
  fontSize: "11px",
};

const checklistStyle = {
  padding: "11px",
  marginBottom: "14px",
  borderRadius: "10px",
  background: "#F8FAFC",
  fontSize: "11px",
  color: "#475569",
};

const checkGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "4px 10px",
  marginTop: "7px",
};

const primaryButtonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  border: "none",
  color: "#FFFFFF",
  fontWeight: "600",
  cursor: "pointer",
  background:
    "linear-gradient(135deg, #7C3AED, #EC4899)",
};

const messageStyle = {
  marginTop: "16px",
  color: "#B91C1C",
};

const successMessageStyle = {
  marginTop: "16px",
  color: "#166534",
};
