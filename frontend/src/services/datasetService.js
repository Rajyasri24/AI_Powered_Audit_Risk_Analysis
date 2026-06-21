import { api } from "./api";

export const uploadDataset = async (
  clientId,
  file
) => {
  const formData = new FormData();

  formData.append("client_id", clientId);
  formData.append("file", file);

  const response = await api.post(
    "/datasets/upload",
    formData,
    {
      headers: {
        "Content-Type":
          "multipart/form-data",
      },
    }
  );

  return response.data;
};