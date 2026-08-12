import { api } from "./api";

export const getNetworkDatasets = async () => {
  const response = await api.get("/network/datasets");
  return response.data;
};

export const analyseNetwork = async (datasetId) => {
  const response = await api.get(`/network/analyse/${datasetId}`);
  return response.data;
};