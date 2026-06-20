import { api } from "./api";

export const getClientRules = async (clientId) => {
  const response = await api.get(`/client-rules/${clientId}`);
  return response.data;
};

export const updateClientRule = async (clientRuleId, payload) => {
  const response = await api.put(`/client-rules/${clientRuleId}`, payload);
  return response.data;
};

export const createCustomRule = async (payload) => {
  const response = await api.post("/client-rules/custom", payload);
  return response.data;
};