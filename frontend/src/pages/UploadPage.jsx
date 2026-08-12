import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getClients } from "../services/clientService";
import { uploadDataset } from "../services/datasetService";

export default function UploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    const clientIdFromUrl = searchParams.get("clientId");

    if (clientIdFromUrl) {
      setSelectedClient(clientIdFromUrl);
      setUploadResult(null);
    }
  }, [searchParams]);

  const loadClients = async () => {
    try {
      setPageLoading(true);

      const data = await getClients();
      const clientList = Array.isArray(data) ? data : [];

      setClients(clientList);

      const clientIdFromUrl = searchParams.get("clientId");

      if (
        clientIdFromUrl &&
        clientList.some(
          (client) => String(client.id) === String(clientIdFromUrl)
        )
      ) {
        setSelectedClient(clientIdFromUrl);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to load clients.");
    } finally {
      setPageLoading(false);
    }
  };

  const selectedClientDetails = useMemo(() => {
    return clients.find(
      (client) =>
        String(client.id) === String(selectedClient)
    );
  }, [clients, selectedClient]);

  const handleClientChange = (clientId) => {
    setSelectedClient(clientId);
    setSelectedFile(null);
    setUploadResult(null);

    if (clientId) {
      navigate(`/upload?clientId=${clientId}`, {
        replace: true,
      });
    } else {
      navigate("/upload", {
        replace: true,
      });
    }
  };

  const handleFileChange = (file) => {
    if (!file) return;

    const allowedExtensions = [
      "csv",
      "xlsx",
      "json",
    ];

    const extension = file.name
      .split(".")
      .pop()
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      alert(
        "Only CSV, XLSX and JSON files are supported."
      );
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!selectedClient) {
      alert("Please select a client.");
      return;
    }

    if (!selectedFile) {
      alert("Please choose a dataset file.");
      return;
    }

    try {
      setLoading(true);

      const result = await uploadDataset(
        selectedClient,
        selectedFile
      );

      setUploadResult(result);
      alert("Dataset uploaded successfully.");
    } catch (error) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Upload failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const goToAnalysis = () => {
    const datasetId = uploadResult?.dataset?.id;

    if (datasetId && selectedClient) {
      navigate(
        `/analysis?clientId=${selectedClient}&datasetId=${datasetId}`
      );
      return;
    }

    if (selectedClient) {
      navigate(
        `/analysis?clientId=${selectedClient}`
      );
      return;
    }

    navigate("/analysis");
  };

  const goToRules = () => {
    if (selectedClient) {
      navigate(`/rules?clientId=${selectedClient}`);
      return;
    }

    navigate("/rules");
  };

  const goToDatasets = () => {
    if (selectedClient) {
      navigate(
        `/datasets?clientId=${selectedClient}`
      );
      return;
    }

    navigate("/datasets");
  };

  const validation = uploadResult?.validation;
  const dataset = uploadResult?.dataset;
  const preview = uploadResult?.preview || [];
  const mapping = uploadResult?.mapping || {};

  return (
    <div>
      <h1 className="page-title">
        Dataset Upload
      </h1>

      <p className="page-subtitle">
        Upload ERP or transaction datasets for
        validation, schema mapping, and audit analysis.
      </p>

      <div className="nav-actions">
        <button
          className="secondary-btn"
          onClick={() => navigate("/clients")}
        >
          ← Back to Client Management
        </button>

        <button
          className="secondary-btn"
          onClick={goToDatasets}
        >
          Manage Datasets
        </button>

        <button
          className="primary-btn"
          onClick={goToAnalysis}
        >
          Run Analysis →
        </button>
      </div>

      {selectedClientDetails && (
        <div className="preview-box">
          <strong>Current Client Context</strong>

          <p style={{ marginBottom: 0 }}>
            {selectedClientDetails.client_code ||
              "NO-CODE"}{" "}
            - {selectedClientDetails.client_name}
          </p>
        </div>
      )}

      <div
        className="card"
        style={{ marginTop: "24px" }}
      >
        <h2 style={{ marginTop: 0 }}>
          1. Select Client
        </h2>

        {pageLoading && <p>Loading clients...</p>}

        <div style={responsiveRowStyle}>
          <select
            value={selectedClient}
            onChange={(event) =>
              handleClientChange(event.target.value)
            }
          >
            <option value="">
              -- Select Client --
            </option>

            {clients.map((client) => (
              <option
                key={client.id}
                value={client.id}
              >
                {client.client_code || "NO-CODE"} -{" "}
                {client.client_name}
              </option>
            ))}
          </select>

          {selectedClient && (
            <button
              className="secondary-btn"
              onClick={() =>
                handleClientChange("")
              }
            >
              Clear Client
            </button>
          )}
        </div>

        {selectedClientDetails && (
          <div style={clientDetailsStyle}>
            <InfoItem
              label="Client"
              value={
                selectedClientDetails.client_name
              }
            />

            <InfoItem
              label="Client Code"
              value={
                selectedClientDetails.client_code
              }
            />

            <InfoItem
              label="Industry"
              value={
                selectedClientDetails.industry
              }
            />

            <InfoItem
              label="Risk Profile"
              value={
                selectedClientDetails.risk_profile
              }
            />
          </div>
        )}
      </div>

      <div
        className="card"
        style={{ marginTop: "24px" }}
      >
        <h2 style={{ marginTop: 0 }}>
          2. Upload Dataset
        </h2>

        <label
          htmlFor="dataset-file"
          style={uploadBoxStyle}
          onDragOver={(event) =>
            event.preventDefault()
          }
          onDrop={(event) => {
            event.preventDefault();

            handleFileChange(
              event.dataTransfer.files?.[0]
            );
          }}
        >
          <div style={{ fontSize: "36px" }}>
            ⬆
          </div>

          <h3 style={{ margin: "8px 0" }}>
            Drop your dataset here
          </h3>

          <p
            style={{
              color: "#6B7280",
              margin: 0,
            }}
          >
            Supports CSV, XLSX and JSON transaction
            files
          </p>

          <p
            style={{
              color: "#7C3AED",
              fontWeight: 700,
            }}
          >
            Browse file
          </p>

          <input
            id="dataset-file"
            type="file"
            accept=".csv,.xlsx,.json"
            style={{ display: "none" }}
            onChange={(event) =>
              handleFileChange(
                event.target.files?.[0]
              )
            }
          />
        </label>

        {selectedFile && (
          <div className="preview-box">
            <strong>Selected File</strong>

            <p style={{ marginBottom: 0 }}>
              {selectedFile.name} •{" "}
              {formatBytes(selectedFile.size)}
            </p>
          </div>
        )}

        <button
          className="primary-btn"
          onClick={handleUpload}
          disabled={
            loading ||
            !selectedClient ||
            !selectedFile
          }
        >
          {loading
            ? "Uploading..."
            : "Upload Dataset"}
        </button>
      </div>

      {uploadResult && (
        <>
          <div style={statsGridStyle}>
            <StatCard
              title="Records"
              value={dataset?.total_records ?? 0}
            />

            <StatCard
              title="Columns"
              value={dataset?.total_columns ?? 0}
            />

            <StatCard
              title="Missing Values"
              value={
                validation?.missing_values ?? 0
              }
            />

            <StatCard
              title="Duplicates"
              value={
                validation?.duplicate_rows ?? 0
              }
            />

            <StatCard
              title="Invalid Amounts"
              value={
                validation?.invalid_amounts ?? 0
              }
            />

            <StatCard
              title="Invalid Dates"
              value={
                validation?.invalid_dates ?? 0
              }
            />
          </div>

          <div
            className="card"
            style={{ marginTop: "24px" }}
          >
            <h2 style={{ marginTop: 0 }}>
              Dataset Summary
            </h2>

            <div className="form-grid">
              <InfoItem
                label="Client"
                value={
                  selectedClientDetails?.client_name
                }
              />

              <InfoItem
                label="Dataset Name"
                value={dataset?.dataset_name}
              />

              <InfoItem
                label="File Type"
                value={dataset?.file_type}
              />

              <InfoItem
                label="Upload Status"
                value={
                  <span
                    className={getStatusBadgeClass(
                      dataset?.upload_status
                    )}
                  >
                    {dataset?.upload_status ||
                      "UNKNOWN"}
                  </span>
                }
              />

              <InfoItem
                label="Validation Status"
                value={
                  <span
                    className={getStatusBadgeClass(
                      validation?.status
                    )}
                  >
                    {validation?.status ||
                      "UNKNOWN"}
                  </span>
                }
              />
            </div>
          </div>

          <div
            className="card"
            style={{ marginTop: "24px" }}
          >
            <h2 style={{ marginTop: 0 }}>
              Validation Summary
            </h2>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Check</th>
                    <th>Result</th>
                    <th>Interpretation</th>
                  </tr>
                </thead>

                <tbody>
                  <ValidationRow
                    label="Duplicate Rows"
                    value={
                      validation?.duplicate_rows
                    }
                    warningText="Duplicate transaction records found."
                  />

                  <ValidationRow
                    label="Missing Values"
                    value={
                      validation?.missing_values
                    }
                    warningText="Some required or useful fields are missing."
                  />

                  <ValidationRow
                    label="Invalid Amounts"
                    value={
                      validation?.invalid_amounts
                    }
                    warningText="Some amount fields are invalid."
                  />

                  <ValidationRow
                    label="Invalid Dates"
                    value={
                      validation?.invalid_dates
                    }
                    warningText="Some date fields are invalid."
                  />
                </tbody>
              </table>
            </div>
          </div>

          <div
            className="card"
            style={{ marginTop: "24px" }}
          >
            <h2 style={{ marginTop: 0 }}>
              Schema Mapping
            </h2>

            <p style={{ color: "#6B7280" }}>
              The platform automatically maps uploaded
              columns to standard audit fields.
            </p>

            {Object.keys(mapping).length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        Standard Audit Field
                      </th>
                      <th>
                        Detected Source Column
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {Object.entries(mapping).map(
                      ([
                        standardField,
                        sourceColumn,
                      ]) => (
                        <tr key={standardField}>
                          <td>
                            <strong>
                              {standardField}
                            </strong>
                          </td>

                          <td>
                            {String(sourceColumn)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                No automatic mapping detected.
              </p>
            )}
          </div>

          <div
            className="card"
            style={{ marginTop: "24px" }}
          >
            <h2 style={{ marginTop: 0 }}>
              Dataset Preview
            </h2>

            {preview.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(preview[0]).map(
                        (key) => (
                          <th key={key}>
                            {key}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {preview.map(
                      (row, index) => (
                        <tr key={index}>
                          {Object.values(row).map(
                            (
                              value,
                              cellIndex
                            ) => (
                              <td key={cellIndex}>
                                {String(
                                  value ?? ""
                                )}
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No preview available.</p>
            )}
          </div>

          <div
            className="card"
            style={{ marginTop: "24px" }}
          >
            <h2 style={{ marginTop: 0 }}>
              Next Steps
            </h2>

            <div className="nav-actions">
              <button
                className="secondary-btn"
                onClick={goToDatasets}
              >
                Manage Client Datasets
              </button>

              <button
                className="secondary-btn"
                onClick={goToRules}
              >
                Review Client Rules
              </button>

              <button
                className="primary-btn"
                onClick={goToAnalysis}
              >
                Continue to Analysis →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="card">
      <p
        style={{
          color: "#6B7280",
          margin: 0,
        }}
      >
        {title}
      </p>

      <h2
        style={{
          margin: "8px 0 0",
          fontSize: "30px",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={infoItemStyle}>
      <p
        style={{
          margin: 0,
          color: "#6B7280",
          fontSize: "12px",
        }}
      >
        {label}
      </p>

      <strong>{value || "-"}</strong>
    </div>
  );
}

function ValidationRow({
  label,
  value = 0,
  warningText,
}) {
  const hasIssue = Number(value || 0) > 0;

  return (
    <tr>
      <td>{label}</td>

      <td>
        <span
          className={
            hasIssue
              ? "badge badge-high"
              : "badge badge-low"
          }
        >
          {hasIssue ? "Warning" : "Passed"}
        </span>
      </td>

      <td>
        {hasIssue
          ? `${warningText} Count: ${value}`
          : `No ${label.toLowerCase()} detected.`}
      </td>
    </tr>
  );
}

function getStatusBadgeClass(status) {
  if (status === "PASSED") {
    return "badge badge-low";
  }

  if (status === "WARNING") {
    return "badge badge-high";
  }

  if (status === "FAILED") {
    return "badge badge-critical";
  }

  return "badge badge-medium";
}

function formatBytes(bytes) {
  if (!bytes) return "0 Bytes";

  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB",
  ];

  const index = Math.floor(
    Math.log(bytes) / Math.log(1024)
  );

  const safeIndex = Math.min(
    index,
    units.length - 1
  );

  const size =
    bytes / Math.pow(1024, safeIndex);

  return `${size.toFixed(2)} ${units[safeIndex]}`;
}

const uploadBoxStyle = {
  display: "block",
  border: "2px dashed #DDD6FE",
  borderRadius: "20px",
  padding: "clamp(20px, 5vw, 36px)",
  textAlign: "center",
  background: "#F8F9FC",
  cursor: "pointer",
  marginBottom: "18px",
};

const responsiveRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
  alignItems: "center",
};

const clientDetailsStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginTop: "18px",
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "16px",
  marginTop: "24px",
};

const infoItemStyle = {
  background: "#F8F9FC",
  border: "1px solid #E5E7EB",
  borderRadius: "16px",
  padding: "14px",
};