import { api } from "./api";


export const getReportContext = async () => {
  const response = await api.get(
    "/reports/context"
  );

  return response.data;
};


export const previewReport = async (
  params
) => {
  const response = await api.get(
    "/reports/preview",
    {
      params,
    }
  );

  return response.data;
};


export const exportReport = async (
  format,
  params
) => {
  const response = await api.get(
    `/reports/export/${format}`,
    {
      params,
      responseType: "blob",
    }
  );

  const contentDisposition =
    response.headers[
      "content-disposition"
    ];

  let filename =
    `internal_audit_report.${format}`;

  const match =
    contentDisposition?.match(
      /filename="?([^";]+)"?/
    );

  if (match?.[1]) {
    filename = match[1];
  }

  const url = URL.createObjectURL(
    response.data
  );

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};
