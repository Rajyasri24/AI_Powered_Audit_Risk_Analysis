import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { supabase } from "../services/supabaseClient";
import {
  cacheVerifiedProfile,
  canAccess,
  clearAuthStorage,
} from "../utils/rbac";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authorised, setAuthorised] = useState(false);

  useEffect(() => {
    let mounted = true;

    const verifyAccess = async () => {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        const session = sessionData?.session;

        if (sessionError || !session?.user) {
          clearAuthStorage();
          if (mounted) {
            setAuthenticated(false);
            setAuthorised(false);
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, status")
          .eq("id", session.user.id)
          .single();

        if (profileError || !profile || profile.status !== "Active") {
          await supabase.auth.signOut();
          clearAuthStorage();
          if (mounted) {
            setAuthenticated(false);
            setAuthorised(false);
          }
          return;
        }

        cacheVerifiedProfile(profile);

        if (mounted) {
          setAuthenticated(true);
          setAuthorised(canAccess(profile.role, allowedRoles));
        }
      } catch (error) {
        console.error("RBAC verification failed:", error);
        clearAuthStorage();
        if (mounted) {
          setAuthenticated(false);
          setAuthorised(false);
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    verifyAccess();
    return () => {
      mounted = false;
    };
  }, [allowedRoles.join("|")]);

  if (checking) {
    return <div style={{ padding: "24px" }}>Verifying secure access...</div>;
  }

  if (!authenticated) return <Navigate to="/" replace />;
  if (!authorised) return <Navigate to="/dashboard" replace />;

  return children;
}
