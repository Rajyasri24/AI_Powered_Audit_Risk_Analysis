import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getClients } from "../services/clientService";
import {
  cleanupOldDatasets,
  deleteDataset,
  getDatasets,
} from "../services/datasetService";

export default function DatasetsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [selectedClient, setSelectedClient] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const clientIdFromUrl = searchParams.get("clientId");

    if (clientIdFromUrl) {
      setSelectedClient(clientIdFromUrl);
    }

    loadPageData();
  }, [searchParams]);

  const loadPageData = async () => {
    try {
      setLoading(true);

      const [clientData, datasetData] = await Promise.all([
        getClients(),
        getDatasets(),
      ]);

      setClients(Array.isArray(clientData) ? clientData : []);
      setDatasets(Array.isArray(datasetData) ? datasetData : []);
    } catch (error) {
      console.error(error);
      alert("Failed to load datasets.");
    } finally {
      setLoading(false);
    }
  };

  const selectedClientDetails = useMemo(() => {
    return clients.find((client) => client.id === selectedClient);
  }, [clients, selectedClient]);

  const filteredDatasets = useMemo(() => {
    return datasets.filter((dataset) => {
      const text = [
        dataset.dataset_name,
        dataset.file_type,
        dataset.upload_status,
        dataset.clients?.client_name,
        dataset.clients?.client_code,
      ]
        .join(" ")
        .toLowerCase();

      return (
        text.includes(search.toLowerCase()) &&
        (selectedClient === "All" || dataset.client_id === selectedClient) &&
        (statusFilter === "All" || dataset.upload_status === statusFilter)
      );
    });
  }, [datasets, search, selectedClient, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: filteredDatasets.length,
      passed: filteredDatasets.filter((d) => d.upload_status === "PASSED").length,
      warning: filteredDatasets.filter((d) => d.upload_status === "WARNING").length,
      records: filteredDatasets.reduce(
        (sum, item) => sum + Number(item.total_records || 0),
        0
      ),
    };
  }, [filteredDatasets]);

  const handleDelete = async (datasetId) => {
    const confirmDelete = window.confirm(
      "Delete this dataset? Related analyses and findings may also be deleted."
    );

    if (!confirmDelete) return;

    try {
      await deleteDataset(datasetId);
      alert("Dataset deleted successfully.");
      loadPageData();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || "Failed to delete dataset.");
    }
  };

  const handleCleanup = async () => {
    const confirmCleanup = window.confirm(
      "This will delete datasets older than 30 days. Continue?"
    );

    if (!confirmCleanup) return;

    try {
      const result = await cleanupOldDatasets(30);
      alert(result.message || "Cleanup complete.");
      loadPageData();
    } catch (error) {
      console.error(error);
      alert("Cleanup failed.");
    }
  };

  const goToUpload = () => {
    if (selectedClient !== "All") {
      navigate(`/upload?clientId=${selectedClient}`);
      return;
    }

    navigate("/upload");
  };

  const goToAnalysis = (dataset) => {
    navigate(
      `/analysis?clientId=${dataset.client_id || ""}&datasetId=${dataset.id}`
    );
  };

  const goToClientAnalysis = () => {
    if (selectedClient !== "All") {
      navigate(`/analysis?clientId=${selectedClient}`);
      return;
    }

    navigate("/analysis");
  };

  return (
    <div>
      <h1 className="page-title">Dataset Management</h1>
      <p className="page-subtitle">
        Manage uploaded datasets by client, delete unused datasets, and continue
        to analysis.
      </p>

      <div className="nav-actions">
        <button className="secondary-btn" onClick={() => navigate("/clients")}>
          ← Back to Client Management
        </button>

        <button className="primary-btn" onClick={goToUpload}>
          Upload New Dataset
        </button>

        <button className="secondary-btn" onClick={goToClientAnalysis}>
          Run Analysis →
        </button>

        <button className="danger-btn" onClick={handleCleanup}>
          Cleanup Older Than 30 Days
        </button>
      </div>

      {selectedClientDetails && (
        <div className="preview-box">
          Managing datasets for <strong>{selectedClientDetails.client_name}</strong>
        </div>
      )}

      <div style={statsGridStyle}>
        <StatCard title="Datasets Shown" value={stats.total} />
        <StatCard title="Passed Uploads" value={stats.passed} />
        <StatCard title="Warning Uploads" value={stats.warning} />
        <StatCard title="Total Records" value={stats.records} />
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2 style={{ marginTop: 0 }}>Filters</h2>

        <div className="form-grid">
          <input
            placeholder="Search dataset, client, status..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={selectedClient}
            onChange={(event) => setSelectedClient(event.target.value)}
          >
            <option value="All">All Clients</option>

            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.client_code || "NO-CODE"} - {client.client_name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="All">All Status</option>
            <option value="PASSED">Passed</option>
            <option value="WARNING">Warning</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2 style={{ marginTop: 0 }}>Uploaded Datasets</h2>

        {loading && <p>Loading datasets...</p>}

        {!loading && filteredDatasets.length === 0 && (
          <p style={{ color: "#6B7280" }}>No datasets found.</p>
        )}

        {!loading && filteredDatasets.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Records</th>
                  <th>Columns</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredDatasets.map((dataset) => (
                  <tr key={dataset.id}>
                    <td>
                      <strong>{dataset.dataset_name}</strong>
                    </td>

                    <td>
                      {dataset.clients?.client_code || "NO-CODE"} -{" "}
                      {dataset.clients?.client_name || "Unknown"}
                    </td>

                    <td>{dataset.file_type?.toUpperCase()}</td>
                    <td>{dataset.total_records ?? 0}</td>
                    <td>{dataset.total_columns ?? 0}</td>

                    <td>
                      <span className={getStatusBadgeClass(dataset.upload_status)}>
                        {dataset.upload_status || "UNKNOWN"}
                      </span>
                    </td>

                    <td>{formatDate(dataset.upload_date)}</td>

                    <td>
                      <div style={actionStyle}>
                        <button
                          className="primary-btn"
                          onClick={() => goToAnalysis(dataset)}
                        >
                          Run Analysis
                        </button>

                        <button
                          className="secondary-btn"
                          onClick={() =>
                            navigate(
                              `/investigation?clientId=${dataset.client_id}&datasetId=${dataset.id}`
                            )
                          }
                        >
                          View Findings
                        </button>

                        <button
                          className="secondary-btn"
                          onClick={() =>
                            navigate(`/upload?clientId=${dataset.client_id}`)
                          }
                        >
                          Upload More
                        </button>

                        <button
                          className="danger-btn"
                          onClick={() => handleDelete(dataset.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="card">
      <p style={{ color: "#6B7280", margin: 0 }}>{title}</p>
      <h2 style={{ margin: "8px 0 0", fontSize: "30px" }}>{value}</h2>
    </div>
  );
}

function getStatusBadgeClass(status) {
  if (status === "PASSED") return "badge badge-low";
  if (status === "WARNING") return "badge badge-high";
  if (status === "FAILED") return "badge badge-critical";
  return "badge badge-medium";
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleString();
}

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
};

const actionStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};