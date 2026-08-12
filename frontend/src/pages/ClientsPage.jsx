import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createClient,
  deleteClient,
  getClients,
} from "../services/clientService";

import { getDatasets } from "../services/datasetService";

export default function ClientsPage() {
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    client_name: "",
    client_code: "",
    industry: "Manufacturing",
    risk_profile: "Medium",
    client_status: "Active",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
  try {
    setLoading(true);

    const clientData = await getClients();
    setClients(Array.isArray(clientData) ? clientData : []);

    try {
      const datasetData = await getDatasets();
      setDatasets(Array.isArray(datasetData) ? datasetData : []);
    } catch (datasetError) {
      console.error("Dataset count loading failed:", datasetError);
      setDatasets([]);
    }
  } catch (error) {
    console.error(error);
    alert("Failed to load clients.");
  } finally {
    setLoading(false);
  }
};

  const getClientDatasetCount = (clientId) => {
    return datasets.filter((dataset) => dataset.client_id === clientId).length;
  };

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const searchText = `${client.client_name || ""} ${
        client.client_code || ""
      } ${client.industry || ""}`.toLowerCase();

      return (
        searchText.includes(search.toLowerCase()) &&
        (riskFilter === "All" || client.risk_profile === riskFilter) &&
        (statusFilter === "All" || client.client_status === statusFilter)
      );
    });
  }, [clients, search, riskFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: clients.length,
      active: clients.filter((client) => client.client_status === "Active").length,
      highRisk: clients.filter((client) => client.risk_profile === "High").length,
      datasets: datasets.length,
    };
  }, [clients, datasets]);

  const handleCreateClient = async () => {
    if (!form.client_name.trim()) {
      alert("Client name is required.");
      return;
    }

    if (!form.client_code.trim()) {
      alert("Client code is required.");
      return;
    }

    try {
      const response = await createClient({
        client_name: form.client_name.trim(),
        client_code: form.client_code.trim(),
        industry: form.industry,
        risk_profile: form.risk_profile,
        client_status: form.client_status,
      });

      alert(
        response?.rules_created_count
          ? `Client created. ${response.rules_created_count} default rules applied.`
          : "Client created."
      );

      setForm({
        client_name: "",
        client_code: "",
        industry: "Manufacturing",
        risk_profile: "Medium",
        client_status: "Active",
      });

      loadData();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || "Failed to create client.");
    }
  };

  const handleDeleteClient = async (clientId) => {
    const confirmDelete = window.confirm(
      "Are you sure? This will delete the client and related datasets/rules."
    );

    if (!confirmDelete) return;

    try {
      await deleteClient(clientId);
      alert("Client deleted.");
      loadData();
    } catch (error) {
      console.error(error);
      alert("Failed to delete client.");
    }
  };

  return (
    <div>
      <h1 className="page-title">Client Management</h1>
      <p className="page-subtitle">
        Create and manage audit clients. Each client can have multiple datasets,
        rules, analyses, and findings.
      </p>

      <div style={statsGridStyle}>
        <StatCard title="Total Clients" value={stats.total} />
        <StatCard title="Active Clients" value={stats.active} />
        <StatCard title="High Risk Clients" value={stats.highRisk} />
        <StatCard title="Uploaded Datasets" value={stats.datasets} />
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2 style={{ marginTop: 0 }}>Add Client</h2>

        <div className="form-grid">
          <input
            placeholder="Client Name *"
            value={form.client_name}
            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
          />

          <input
            placeholder="Client Code *"
            value={form.client_code}
            onChange={(e) => setForm({ ...form, client_code: e.target.value })}
          />

          <select
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
          >
            <option value="Manufacturing">Manufacturing</option>
            <option value="Banking">Banking</option>
            <option value="Insurance">Insurance</option>
            <option value="Retail">Retail</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Technology">Technology</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={form.risk_profile}
            onChange={(e) => setForm({ ...form, risk_profile: e.target.value })}
          >
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
          </select>

          <select
            value={form.client_status}
            onChange={(e) => setForm({ ...form, client_status: e.target.value })}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <button className="primary-btn" onClick={handleCreateClient}>
            Create Client
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2 style={{ marginTop: 0 }}>Clients</h2>

        <div className="form-grid">
          <input
            placeholder="Search client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="All">All Risk Profiles</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {loading && <p>Loading clients...</p>}

        {!loading && filteredClients.length === 0 && (
          <p style={{ color: "#6B7280" }}>No clients found.</p>
        )}

        <div style={clientGridStyle}>
          {filteredClients.map((client) => (
            <div className="card" key={client.id}>
              <div style={clientHeaderStyle}>
                <div>
                  <h3 style={{ margin: 0 }}>{client.client_name}</h3>
                  <p style={{ color: "#6B7280", margin: "6px 0 0" }}>
                    {client.client_code || "NO-CODE"}
                  </p>
                </div>

                <span className={getRiskBadgeClass(client.risk_profile)}>
                  {client.risk_profile || "Medium"}
                </span>
              </div>

              <div style={clientMetaStyle}>
                <p>
                  <strong>Industry:</strong> {client.industry || "-"}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  <span
                    className={
                      client.client_status === "Inactive"
                        ? "badge badge-critical"
                        : "badge badge-low"
                    }
                  >
                    {client.client_status || "Active"}
                  </span>
                </p>

                <p>
                  <strong>Datasets Uploaded:</strong>{" "}
                  {getClientDatasetCount(client.id)}
                </p>

                <p>
                  <strong>Workflow:</strong> Rules → Datasets → Analysis →
                  Findings
                </p>
              </div>

              <div style={actionGridStyle}>
                <button
                  className="primary-btn"
                  onClick={() => navigate(`/rules?clientId=${client.id}`)}
                >
                  Manage Rules
                </button>

                <button
                  className="secondary-btn"
                  onClick={() => navigate(`/datasets?clientId=${client.id}`)}
                >
                  Manage Datasets
                </button>

                <button
                  className="secondary-btn"
                  onClick={() => navigate(`/upload?clientId=${client.id}`)}
                >
                  Upload Dataset
                </button>

                <button
                  className="secondary-btn"
                  onClick={() => navigate(`/analysis?clientId=${client.id}`)}
                >
                  Run Analysis
                </button>

                <button
                  className="secondary-btn"
                  onClick={() => navigate(`/investigation?clientId=${client.id}`)}
                >
                  View Findings
                </button>

                <button
                  className="danger-btn"
                  onClick={() => handleDeleteClient(client.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
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

function getRiskBadgeClass(riskProfile) {
  if (riskProfile === "High") return "badge badge-high";
  if (riskProfile === "Low") return "badge badge-low";
  return "badge badge-medium";
}

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
};

const clientGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
  gap: "18px",
  marginTop: "22px",
};

const clientHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
};

const clientMetaStyle = {
  marginTop: "18px",
  color: "#374151",
  fontSize: "14px",
};

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: "10px",
  marginTop: "18px",
};