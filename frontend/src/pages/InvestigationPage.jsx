import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getAllFindings } from "../services/findingService";

export default function InvestigationPage() {
  const navigate = useNavigate();

  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");

  useEffect(() => {
    loadFindings();
  }, []);

  const loadFindings = async () => {
    try {
      setLoading(true);
      const data = await getAllFindings();
      setFindings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      alert("Failed to load findings.");
    } finally {
      setLoading(false);
    }
  };

  const filteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      const text = [
        finding.transaction_id,
        finding.risk_level,
        finding.reasons,
        Array.isArray(finding.triggered_rules)
          ? finding.triggered_rules.join(" ")
          : "",
        Array.isArray(finding.anomaly_reasons)
          ? finding.anomaly_reasons.join(" ")
          : "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());

      const matchesRisk =
        riskFilter === "All" || finding.risk_level === riskFilter;

      const sources = Array.isArray(finding.detection_sources)
        ? finding.detection_sources
        : [];

      const matchesSource =
        sourceFilter === "All" || sources.includes(sourceFilter);

      return matchesSearch && matchesRisk && matchesSource;
    });
  }, [findings, search, riskFilter, sourceFilter]);

  const stats = useMemo(() => {
    const total = findings.length;
    const high = findings.filter((f) => f.risk_level === "High").length;
    const critical = findings.filter((f) => f.risk_level === "Critical").length;
    const ml = findings.filter((f) =>
      Array.isArray(f.detection_sources)
        ? f.detection_sources.includes("ML")
        : false
    ).length;

    const avg =
      total === 0
        ? 0
        : Math.round(
            findings.reduce(
              (sum, item) => sum + Number(item.risk_score || 0),
              0
            ) / total
          );

    return {
      total,
      high,
      critical,
      ml,
      avg,
    };
  }, [findings]);

  const splitReasons = (reasons) => {
    if (!reasons) return [];

    return String(reasons)
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const copyInvestigation = async (finding) => {
    const text = buildInvestigationText(finding);

    await navigator.clipboard.writeText(text);
    alert("Investigation summary copied.");
  };

  const exportCsv = () => {
    const headers = [
      "Transaction ID",
      "Risk Level",
      "Rule Score",
      "ML Score",
      "Network Score",
      "Final Risk Score",
      "Detection Sources",
      "Triggered Rules",
      "Reasons",
      "ML Reasons",
    ];

    const rows = filteredFindings.map((finding) => [
      finding.transaction_id,
      finding.risk_level,
      finding.rule_score ?? 0,
      finding.anomaly_score ?? 0,
      finding.network_score ?? 0,
      finding.risk_score ?? 0,
      Array.isArray(finding.detection_sources)
        ? finding.detection_sources.join("; ")
        : "",
      Array.isArray(finding.triggered_rules)
        ? finding.triggered_rules.join("; ")
        : "",
      finding.reasons || "",
      Array.isArray(finding.anomaly_reasons)
        ? finding.anomaly_reasons.join("; ")
        : "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "audit_findings.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1 className="page-title">Findings Investigation</h1>
      <p className="page-subtitle">
        Investigate rule-based findings, ML anomaly explanations, and final risk
        scores.
      </p>

      <div className="nav-actions">
        <button className="secondary-btn" onClick={() => navigate("/analysis")}>
          ← Back to Analysis
        </button>

        <button className="primary-btn" onClick={() => navigate("/reports")}>
          Generate Report →
        </button>

        <button className="secondary-btn" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      <div style={statsGridStyle}>
        <StatCard title="Total Findings" value={stats.total} />
        <StatCard title="High Risk" value={stats.high} />
        <StatCard title="Critical" value={stats.critical} />
        <StatCard title="ML Findings" value={stats.ml} />
        <StatCard title="Average Risk" value={stats.avg} />
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2 style={{ marginTop: 0 }}>Filters</h2>

        <div className="form-grid">
          <input
            placeholder="Search transaction, rule, reason..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value)}
          >
            <option value="All">All Risk Levels</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option value="All">All Detection Sources</option>
            <option value="RULE">Rule Engine</option>
            <option value="ML">ML Engine</option>
            <option value="NETWORK">Network Engine</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2 style={{ marginTop: 0 }}>Findings</h2>

        {loading && <p>Loading findings...</p>}

        {!loading && filteredFindings.length === 0 && (
          <p style={{ color: "#6B7280" }}>No findings match the filters.</p>
        )}

        {!loading &&
          filteredFindings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              expanded={expandedId === finding.id}
              onToggle={() =>
                setExpandedId(expandedId === finding.id ? null : finding.id)
              }
              onCopy={() => copyInvestigation(finding)}
              splitReasons={splitReasons}
            />
          ))}
      </div>
    </div>
  );
}

function FindingCard({ finding, expanded, onToggle, onCopy, splitReasons }) {
  const sources = Array.isArray(finding.detection_sources)
    ? finding.detection_sources
    : [];

  return (
    <div className="card" style={findingCardStyle}>
      <div style={findingTopStyle}>
        <div>
          <h3 style={{ margin: 0 }}>
            Transaction {finding.transaction_id || "-"}
          </h3>
          <p style={{ color: "#6B7280", margin: "6px 0 0" }}>
            Detection Sources:{" "}
            {sources.length > 0
              ? sources.map((source) => (
                  <span key={source} style={{ marginRight: "6px" }}>
                    <SourceBadge source={source} />
                  </span>
                ))
              : "-"}
          </p>
        </div>

        <span className={getRiskBadgeClass(finding.risk_level)}>
          {finding.risk_level || "Low"}
        </span>
      </div>

      <div style={scoreGridStyle}>
        <ScoreBox label="Rule Score" value={finding.rule_score ?? 0} />
        <ScoreBox label="ML Score" value={finding.anomaly_score ?? 0} />
        <ScoreBox label="Network Score" value={finding.network_score ?? 0} />
        <ScoreBox label="Final Risk Score" value={finding.risk_score ?? 0} />
      </div>

      <div style={summaryStyle}>
        <strong>Primary Reason:</strong>{" "}
        {splitReasons(finding.reasons)[0] || "No reason available."}
      </div>

      <div className="nav-actions">
        <button className="secondary-btn" onClick={onToggle}>
          {expanded ? "Hide Details" : "View Details"}
        </button>

        <button className="secondary-btn" onClick={onCopy}>
          Copy Investigation
        </button>
      </div>

      {expanded && (
        <div style={detailStyle}>
          <h4>Triggered Rules</h4>
          {Array.isArray(finding.triggered_rules) &&
          finding.triggered_rules.length > 0 ? (
            <ul>
              {finding.triggered_rules.map((rule, index) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>
          ) : (
            <p>-</p>
          )}

          <h4>Rule / System Reasons</h4>
          {splitReasons(finding.reasons).length > 0 ? (
            <ul>
              {splitReasons(finding.reasons).map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>-</p>
          )}

          <h4>ML Explanations</h4>
          {Array.isArray(finding.anomaly_reasons) &&
          finding.anomaly_reasons.length > 0 ? (
            <ul>
              {finding.anomaly_reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>-</p>
          )}

          <h4>Auditor-Friendly Explanation</h4>
          <p>{generateAuditExplanation(finding, splitReasons)}</p>
        </div>
      )}
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

function ScoreBox({ label, value }) {
  return (
    <div style={scoreBoxStyle}>
      <p style={{ margin: 0, color: "#6B7280", fontSize: "12px" }}>{label}</p>
      <strong style={{ fontSize: "22px" }}>{Number(value)}</strong>
    </div>
  );
}

function SourceBadge({ source }) {
  if (source === "RULE") {
    return <span className="badge badge-medium">RULE</span>;
  }

  if (source === "ML") {
    return <span className="badge badge-low">ML</span>;
  }

  if (source === "NETWORK") {
    return <span className="badge badge-high">NETWORK</span>;
  }

  return <span className="badge badge-medium">{source}</span>;
}

function getRiskBadgeClass(riskLevel) {
  if (riskLevel === "Critical") return "badge badge-critical";
  if (riskLevel === "High") return "badge badge-high";
  if (riskLevel === "Medium") return "badge badge-medium";
  return "badge badge-low";
}

function generateAuditExplanation(finding, splitReasons) {
  const sources = Array.isArray(finding.detection_sources)
    ? finding.detection_sources
    : [];

  const parts = [];

  if (sources.includes("RULE")) {
    parts.push(
      "The transaction was flagged by the rule engine because it matched one or more configured audit risk rules."
    );
  }

  if (sources.includes("ML")) {
    parts.push(
      "The transaction was also identified by the machine learning anomaly detection layer, indicating that its behavior is statistically unusual compared with the uploaded dataset."
    );
  }

  if (sources.includes("NETWORK")) {
    parts.push(
      "The transaction has network-based risk indicators based on entity relationship analysis."
    );
  }

  const reasons = splitReasons(finding.reasons);

  if (reasons.length > 0) {
    parts.push(`Main evidence: ${reasons.join("; ")}.`);
  }

  parts.push(
    `The final risk score is ${Number(
      finding.risk_score || 0
    )}, categorized as ${finding.risk_level || "Low"}.`
  );

  return parts.join(" ");
}

function buildInvestigationText(finding) {
  const triggeredRules = Array.isArray(finding.triggered_rules)
    ? finding.triggered_rules.join(", ")
    : "-";

  const anomalyReasons = Array.isArray(finding.anomaly_reasons)
    ? finding.anomaly_reasons.join("; ")
    : "-";

  const sources = Array.isArray(finding.detection_sources)
    ? finding.detection_sources.join(", ")
    : "-";

  return `
Transaction ID: ${finding.transaction_id}
Risk Level: ${finding.risk_level}
Final Risk Score: ${finding.risk_score}
Rule Score: ${finding.rule_score}
ML Score: ${finding.anomaly_score}
Network Score: ${finding.network_score}

Detection Sources:
${sources}

Triggered Rules:
${triggeredRules}

Reasons:
${finding.reasons || "-"}

ML Explanations:
${anomalyReasons}
`;
}

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
};

const findingCardStyle = {
  marginBottom: "18px",
  boxShadow: "none",
};

const findingTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const scoreGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
  marginTop: "18px",
};

const scoreBoxStyle = {
  background: "#F8F9FC",
  border: "1px solid #E5E7EB",
  borderRadius: "16px",
  padding: "14px",
};

const summaryStyle = {
  background: "#F8F9FC",
  border: "1px solid #E5E7EB",
  borderRadius: "14px",
  padding: "14px",
  marginTop: "18px",
};

const detailStyle = {
  marginTop: "18px",
  background: "#FFFFFF",
  borderTop: "1px solid #E5E7EB",
  paddingTop: "18px",
};