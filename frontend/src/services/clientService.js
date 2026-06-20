import { api } from "./api";

export const getClients = async () => {
  const response = await api.get("/clients/");
  return response.data;
};