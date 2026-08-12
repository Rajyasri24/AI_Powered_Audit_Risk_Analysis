import { api } from "./api";

export const getCopilotContext = async () => {
  const response = await api.get("/copilot/context");
  return response.data;
};

export const getCopilotHistory = async (limit = 20) => {
  const response = await api.get("/copilot/history", {
    params: { limit },
  });
  return response.data;
};

export const askCopilot = async ({
  question,
  clientId,
  datasetId,
  transactionId,
}) => {
  const response = await api.post("/copilot/ask", {
    question,
    client_id: clientId || null,
    dataset_id: datasetId || null,
    transaction_id: transactionId || null,
  });
  return response.data;
};
