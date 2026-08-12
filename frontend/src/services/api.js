import axios from "axios";
import { supabase } from "./supabaseClient";

const baseURL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL,
  timeout: 120000,
});

api.interceptors.request.use(async (config) => {
  const { data, error } = await supabase.auth.getSession();

  if (!error && data?.session?.access_token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await supabase.auth.signOut();
      localStorage.removeItem("user_role");
      localStorage.removeItem("user_name");
      localStorage.removeItem("user_id");

      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
