import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { supabase } from "../services/supabaseClient";

export default function ProtectedRoute({ children }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) {
    return <p style={{ padding: "40px" }}>Checking authentication...</p>;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return children;
}