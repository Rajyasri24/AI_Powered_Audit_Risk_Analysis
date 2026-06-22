import { useEffect, useState } from "react";

import { getDashboardSummary } from "../services/dashboardService";

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await getDashboardSummary();
      setSummary(data);
    } catch (error) {
      console.error(error);
      alert("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p>Loading dashboard...</p>;
  }

  if (!summary) {
    return <p>No dashboard data available.</p>;
  }

  return (
    <div>
      <h1>Audit Risk Dashboard</h1>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <DashboardCard title="Clients" value={summary.total_clients} />
        <DashboardCard title="Datasets" value={summary.total_datasets} />
        <DashboardCard title="Analyses" value={summary.total_analyses} />
        <DashboardCard title="Findings" value={summary.total_findings} />
      </div>

      <h2 style={{ marginTop: "30px" }}>Risk Distribution</h2>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <RiskCard label="Low" value={summary.risk_counts.Low} />
        <RiskCard label="Medium" value={summary.risk_counts.Medium} />
        <RiskCard label="High" value={summary.risk_counts.High} />
        <RiskCard label="Critical" value={summary.risk_counts.Critical} />
      </div>

      <h2 style={{ marginTop: "30px" }}>Top Triggered Rules</h2>

      {summary.top_triggered_rules.length === 0 ? (
        <p>No triggered rules yet.</p>
      ) : (
        <table border="1" cellPadding="8" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Count</th>
            </tr>
          </thead>

          <tbody>
            {summary.top_triggered_rules.map((rule) => (
              <tr key={rule.rule_name}>
                <td>{rule.rule_name}</td>
                <td>{rule.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: "30px" }}>Recent Analyses</h2>

      {summary.recent_analyses.length === 0 ? (
        <p>No analyses yet.</p>
      ) : (
        <table border="1" cellPadding="8" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Analysis ID</th>
              <th>Status</th>
              <th>Total Transactions</th>
              <th>High Risk Count</th>
            </tr>
          </thead>

          <tbody>
            {summary.recent_analyses.map((analysis) => (
              <tr key={analysis.id}>
                <td>{analysis.id}</td>
                <td>{analysis.analysis_status}</td>
                <td>{analysis.total_transactions}</td>
                <td>{analysis.high_risk_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DashboardCard({ title, value }) {
  return (
    <div style={cardStyle}>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}

function RiskCard({ label, value }) {
  return (
    <div style={cardStyle}>
      <p>{label}</p>
      <h2>{value}</h2>
    </div>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #E5E7EB",
  borderRadius: "16px",
  padding: "18px",
  minWidth: "180px",
};