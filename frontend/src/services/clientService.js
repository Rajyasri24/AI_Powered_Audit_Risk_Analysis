import { api } from "./api";

export const getClients = async () => {
  const response = await api.get("/clients/");
  return response.data;
};

export const createClient = async (payload) => {
  const response = await api.post("/clients/", payload);
  return response.data;
};

export const deleteClient = async (clientId) => {
  const response = await api.delete(`/clients/${clientId}`);
  return response.data;
};