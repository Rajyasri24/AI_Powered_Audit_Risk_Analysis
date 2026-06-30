import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createClient,
  deleteClient,
  getClients,
} from "../services/clientService";

export default function ClientsPage() {
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
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
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await getClients();
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      alert("Failed to load clients.");
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const searchText = `${client.client_name || ""} ${
        client.client_code || ""
      } ${client.industry || ""}`.toLowerCase();

      const matchesSearch = searchText.includes(search.toLowerCase());

      const matchesRisk =
        riskFilter === "All" || client.risk_profile === riskFilter;

      const matchesStatus =
        statusFilter === "All" || client.client_status === statusFilter;

      return matchesSearch && matchesRisk && matchesStatus;
    });
  }, [clients, search, riskFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: clients.length,
      active: clients.filter((client) => client.client_status === "Active")
        .length,
      highRisk: clients.filter((client) => client.risk_profile === "High")
        .length,
      inactive: clients.filter((client) => client.client_status === "Inactive")
        .length,
    };
  }, [clients]);

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

      loadClients();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || "Failed to create client.");
    }
  };

  const handleDeleteClient = async (clientId) => {
    const confirmDelete = window.confirm(
      "Are you sure? This will delete the client and related datasets, rules, analyses, and findings."
    );

    if (!confirmDelete) return;

    try {
      await deleteClient(clientId);
      alert("Client deleted.");
      loadClients();
    } catch (error) {
      console.error(error);
      alert("Failed to delete client.");
    }
  };

  return (
    <div>
      <h1 className="page-title">Client Management</h1>
      <p className="page-subtitle">
        Create and manage audit clients. Each new client automatically receives
        default audit rules.
      </p>

      <div className="nav-actions">
        <button className="primary-btn" onClick={() => navigate("/rules")}>
          Manage Rules
        </button>
        <button className="secondary-btn" onClick={() => navigate("/upload")}>
          Upload Dataset
        </button>
        <button className="secondary-btn" onClick={() => navigate("/analysis")}>
          Run Analysis
        </button>
      </div>

      <div style={statsGridStyle}>
        <StatCard title="Total Clients" value={stats.total} />
        <StatCard title="Active Clients" value={stats.active} />
        <StatCard title="High Risk Clients" value={stats.highRisk} />
        <StatCard title="Inactive Clients" value={stats.inactive} />
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2 style={{ marginTop: 0 }}>Add Client</h2>

        <div className="form-grid">
          <div>
            <label>Client Name *</label>
            <input
              placeholder="Example: ABC Manufacturing Ltd"
              value={form.client_name}
              onChange={(e) =>
                setForm({ ...form, client_name: e.target.value })
              }
            />
            <small>Legal or business name of the audit client.</small>
          </div>

          <div>
            <label>Client Code *</label>
            <input
              placeholder="Example: ABC001"
              value={form.client_code}
              onChange={(e) =>
                setForm({ ...form, client_code: e.target.value })
              }
            />
            <small>Unique short code for identifying the client.</small>
          </div>

          <div>
            <label>Industry</label>
            <select
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            >
              <option value="Manufacturing">Manufacturing</option>
              <option value="Banking">Banking</option>
              <option value="Insurance">Insurance</option>
              <option value="Retail">Retail</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Education">Education</option>
              <option value="Government">Government</option>
              <option value="Technology">Technology</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label>Risk Profile</label>
            <select
              value={form.risk_profile}
              onChange={(e) =>
                setForm({ ...form, risk_profile: e.target.value })
              }
            >
              <option value="Low">Low Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="High">High Risk</option>
            </select>
          </div>

          <div>
            <label>Status</label>
            <select
              value={form.client_status}
              onChange={(e) =>
                setForm({ ...form, client_status: e.target.value })
              }
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="primary-btn" onClick={handleCreateClient}>
              Create Client
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Clients</h2>
            <p style={{ color: "#6B7280", margin: "6px 0 0" }}>
              Search, filter, and continue the audit workflow for each client.
            </p>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: "18px" }}>
          <input
            placeholder="Search by client name, code, or industry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="All">All Risk Profiles</option>
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
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
          <p style={{ color: "#6B7280" }}>No clients match the current filters.</p>
        )}

        {!loading && filteredClients.length > 0 && (
          <div style={clientGridStyle}>
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onManageRules={() => navigate(`/rules?clientId=${client.id}`)}
                onUpload={() => navigate("/upload")}
                onAnalysis={() => navigate("/analysis")}
                onFindings={() => navigate("/investigation")}
                onReports={() => navigate("/reports")}
                onDelete={() => handleDeleteClient(client.id)}
              />
            ))}
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

function ClientCard({
  client,
  onManageRules,
  onUpload,
  onAnalysis,
  onFindings,
  onReports,
  onDelete,
}) {
  return (
    <div className="card">
      <div style={clientCardTopStyle}>
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
          <strong>Default Rules:</strong> Applied on creation
        </p>
        <p>
          <strong>Workflow:</strong> Rules → Upload → Analysis → Findings
        </p>
      </div>

      <div style={actionGridStyle}>
        <button className="primary-btn" onClick={onManageRules}>
          Manage Rules
        </button>
        <button className="secondary-btn" onClick={onUpload}>
          Upload Dataset
        </button>
        <button className="secondary-btn" onClick={onAnalysis}>
          Run Analysis
        </button>
        <button className="secondary-btn" onClick={onFindings}>
          View Findings
        </button>
        <button className="secondary-btn" onClick={onReports}>
          Reports
        </button>
        <button className="danger-btn" onClick={onDelete}>
          Delete
        </button>
      </div>
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

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
};

const clientGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "18px",
  marginTop: "22px",
};

const clientCardTopStyle = {
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