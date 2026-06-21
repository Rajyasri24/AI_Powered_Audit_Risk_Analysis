import { api } from "./api";

export const runAnalysis = async (datasetId) => {
  const response = await api.post(`/analysis/run/${datasetId}`);
  return response.data;
};