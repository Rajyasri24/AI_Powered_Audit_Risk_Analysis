import { api } from "./api";

export const getAllFindings = async () => {
  const response = await api.get("/findings/");
  return response.data;
};

export const getFindingById = async (findingId) => {
  const response = await api.get(`/findings/${findingId}`);
  return response.data;
};