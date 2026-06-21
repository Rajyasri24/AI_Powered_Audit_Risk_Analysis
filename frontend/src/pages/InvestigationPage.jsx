import { useEffect, useState } from "react";

import { getAllFindings } from "../services/findingService";

export default function InvestigationPage() {
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFindings();
  }, []);

  const loadFindings = async () => {
    try {
      setLoading(true);
      const data = await getAllFindings();
      setFindings(data);
    } catch (error) {
      console.error(error);
      alert("Failed to load findings");
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeStyle = (riskLevel) => {
    if (riskLevel === "Critical") {
      return {
        background: "#FEE2E2",
        color: "#B91C1C",
        padding: "4px 10px",
        borderRadius: "999px",
        fontWeight: "600",
      };
    }

    if (riskLevel === "High") {
      return {
        background: "#FED7AA",
        color: "#C2410C",
        padding: "4px 10px",
        borderRadius: "999px",
        fontWeight: "600",
      };
    }

    if (riskLevel === "Medium") {
      return {
        background: "#FEF3C7",
        color: "#B45309",
        padding: "4px 10px",
        borderRadius: "999px",
        fontWeight: "600",
      };
    }

    return {
      background: "#DCFCE7",
      color: "#15803D",
      padding: "4px 10px",
      borderRadius: "999px",
      fontWeight: "600",
    };
  };

  return (
    <div>
      <h1>Findings Investigation</h1>

      {loading && <p>Loading findings...</p>}

      {!loading && findings.length === 0 && (
        <p>No findings available yet.</p>
      )}

      {findings.length > 0 && (
        <table border="1" cellPadding="8" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Triggered Rules</th>
              <th>Risk Score</th>
              <th>Risk Level</th>
              <th>Reason</th>
              <th>Analysis ID</th>
            </tr>
          </thead>

          <tbody>
            {findings.map((finding) => (
              <tr key={finding.id}>
                <td>{finding.transaction_id}</td>

                <td>
                  {Array.isArray(finding.triggered_rules)
                    ? finding.triggered_rules.join(", ")
                    : "-"}
                </td>

                <td>{finding.risk_score}</td>

                <td>
                  <span style={getRiskBadgeStyle(finding.risk_level)}>
                    {finding.risk_level}
                  </span>
                </td>

                <td>{finding.reasons}</td>

                <td>{finding.analysis_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}