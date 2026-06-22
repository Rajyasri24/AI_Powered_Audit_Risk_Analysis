import { useEffect, useState } from "react";

import { getDatasets } from "../services/datasetService";
import { runAnalysis } from "../services/analysisService";

export default function AnalysisPage() {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    const data = await getDatasets();
    setDatasets(data);
  };

  const handleRunAnalysis = async () => {
    if (!selectedDataset) {
      alert("Please select a dataset");
      return;
    }

    try {
      setLoading(true);
      const result = await runAnalysis(selectedDataset);
      setAnalysisResult(result);
      alert("Analysis completed");
    } catch (error) {
      console.error(error);
      alert("Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Run Audit Analysis</h1>

      <div style={{ marginBottom: "20px" }}>
        <label>Select Dataset</label>
        <br />

        <select
          value={selectedDataset}
          onChange={(event) => setSelectedDataset(event.target.value)}
        >
          <option value="">Select Dataset</option>

          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.dataset_name} - {dataset.clients?.client_name}
            </option>
          ))}
        </select>
      </div>

      <button onClick={handleRunAnalysis} disabled={loading}>
        {loading ? "Running..." : "Run Analysis"}
      </button>

      {analysisResult && (
        <>
          <hr />

          <h2>Analysis Summary</h2>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <Card title="Total Transactions" value={analysisResult.total_transactions} />
            <Card title="Rule Findings" value={analysisResult.rule_findings_count} />
            <Card title="ML Findings" value={analysisResult.ml_findings_count} />
            <Card title="Final Findings" value={analysisResult.findings_count} />
            <Card title="High / Critical" value={analysisResult.high_risk_count} />
          </div>

          <h2 style={{ marginTop: "24px" }}>Findings Preview</h2>

          {analysisResult.findings_preview.length === 0 ? (
            <p>No findings detected.</p>
          ) : (
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
                  <th>Anomaly Reasons</th>
                </tr>
              </thead>

              <tbody>
                {analysisResult.findings_preview.map((finding, index) => (
                  <tr key={index}>
                    <td>{finding.transaction_id}</td>
                    <td>{finding.rule_score}</td>
                    <td>{finding.anomaly_score}</td>
                    <td>{finding.network_score}</td>
                    <td>{finding.risk_score}</td>
                    <td>
                      <span style={getRiskBadgeStyle(finding.risk_level)}>
                        {finding.risk_level}
                      </span>
                    </td>
                    <td>{finding.detection_sources?.join(", ")}</td>
                    <td>{finding.triggered_rules?.join(", ") || "-"}</td>
                    <td>
                      {finding.anomaly_reasons?.length > 0 ? (
                        <ul>
                          {finding.anomaly_reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
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
        </>
      )}
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={cardStyle}>
      <p>{title}</p>
      <h2>{value ?? 0}</h2>
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

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #E5E7EB",
  borderRadius: "16px",
  padding: "16px",
  minWidth: "180px",
};