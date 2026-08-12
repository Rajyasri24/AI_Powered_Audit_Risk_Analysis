import { api } from "./api";

export const uploadDataset = async (clientId, file) => {
  const formData = new FormData();

  formData.append("client_id", clientId);
  formData.append("file", file);

  const response = await api.post("/datasets/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const getDatasets = async () => {
  const response = await api.get("/datasets/");
  return response.data;
};

export const getDatasetById = async (datasetId) => {
  const response = await api.get(`/datasets/${datasetId}`);
  return response.data;
};

export const deleteDataset = async (datasetId) => {
  const response = await api.delete(`/datasets/${datasetId}`);
  return response.data;
};

export const cleanupOldDatasets = async (days = 30) => {
  const response = await api.delete(`/datasets/cleanup-old/${days}`);
  return response.data;
};











































