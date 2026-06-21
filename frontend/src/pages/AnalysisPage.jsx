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
            <div style={cardStyle}>
              <p>Total Transactions</p>
              <h2>{analysisResult.total_transactions}</h2>
            </div>

            <div style={cardStyle}>
              <p>Total Findings</p>
              <h2>{analysisResult.findings_count}</h2>
            </div>

            <div style={cardStyle}>
              <p>Low Risk</p>
              <h2>{analysisResult.low_risk_count}</h2>
            </div>

            <div style={cardStyle}>
              <p>Medium Risk</p>
              <h2>{analysisResult.medium_risk_count}</h2>
            </div>

            <div style={cardStyle}>
              <p>High / Critical Risk</p>
              <h2>{analysisResult.high_risk_count}</h2>
            </div>
          </div>

          <h2 style={{ marginTop: "24px" }}>Findings Preview</h2>

          {analysisResult.findings_preview.length === 0 ? (
            <p>No findings detected.</p>
          ) : (
            <table border="1" cellPadding="8" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Triggered Rule</th>
                  <th>Risk Score</th>
                  <th>Risk Level</th>
                  <th>Reason</th>
                </tr>
              </thead>

              <tbody>
                {analysisResult.findings_preview.map((finding, index) => (
                  <tr key={index}>
                    <td>{finding.transaction_id}</td>
                    <td>{finding.triggered_rules?.join(", ")}</td>
                    <td>{finding.risk_score}</td>
                    <td>
                      <span style={getRiskBadgeStyle(finding.risk_level)}>
                        {finding.risk_level}
                      </span>
                    </td>
                    <td>{finding.reasons}</td>
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

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #E5E7EB",
  borderRadius: "16px",
  padding: "16px",
  minWidth: "180px",
};