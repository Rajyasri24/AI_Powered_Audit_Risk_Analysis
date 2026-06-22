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

  return (
    <div>
      <h1>Findings Investigation</h1>

      {loading && <p>Loading findings...</p>}

      {!loading && findings.length === 0 && <p>No findings available yet.</p>}

      {findings.length > 0 && (
        <table border="1" cellPadding="8" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Rule Score</th>
              <th>ML Score</th>
              <th>Network Score</th>
              <th>Final Score</th>
              <th>Risk Level</th>
              <th>Sources</th>
              <th>Triggered Rules</th>
              <th>Reasons</th>
              <th>ML Explanation</th>
            </tr>
          </thead>

          <tbody>
            {findings.map((finding) => (
              <tr key={finding.id}>
                <td>{finding.transaction_id}</td>
                <td>{finding.rule_score ?? 0}</td>
                <td>{finding.anomaly_score ?? 0}</td>
                <td>{finding.network_score ?? 0}</td>
                <td>{finding.risk_score ?? 0}</td>

                <td>
                  <span style={getRiskBadgeStyle(finding.risk_level)}>
                    {finding.risk_level}
                  </span>
                </td>

                <td>
                  {Array.isArray(finding.detection_sources)
                    ? finding.detection_sources.join(", ")
                    : "-"}
                </td>

                <td>
                  {Array.isArray(finding.triggered_rules)
                    ? finding.triggered_rules.join(", ")
                    : "-"}
                </td>

                <td>{finding.reasons}</td>

                <td>
                  {Array.isArray(finding.anomaly_reasons) &&
                  finding.anomaly_reasons.length > 0 ? (
                    <ul>
                      {finding.anomaly_reasons.map((reason, index) => (
                        <li key={index}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function getRiskBadgeStyle(riskLevel) {
  if (riskLevel === "Critical") {
    return badge("#FEE2E2", "#B91C1C");
  }

  if (riskLevel === "High") {
    return badge("#FED7AA", "#C2410C");
  }

  if (riskLevel === "Medium") {
    return badge("#FEF3C7", "#B45309");
  }

  return badge("#DCFCE7", "#15803D");
}

function badge(background, color) {
  return {
    background,
    color,
    padding: "4px 10px",
    borderRadius: "999px",
    fontWeight: "600",
  };
}