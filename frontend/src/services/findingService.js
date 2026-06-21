import { api } from "./api";

export const getAllFindings = async () => {
  const response = await api.get("/findings/");
  return response.data;
};

export const getFindingsByAnalysis = async (analysisId) => {
  const response = await api.get(`/findings/${analysisId}`);
  return response.data;
};