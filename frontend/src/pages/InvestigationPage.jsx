import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import NetworkGraphModal from "../components/NetworkGraphModal";

import {
  getAllFindings,
} from "../services/findingService";


export default function InvestigationPage() {
  const navigate = useNavigate();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [findings, setFindings] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [expandedId, setExpandedId] =
    useState(null);

  const [networkModalOpen, setNetworkModalOpen] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [clientFilter, setClientFilter] =
    useState("All");

  const [datasetFilter, setDatasetFilter] =
    useState("All");

  const [analysisFilter, setAnalysisFilter] =
    useState("All");

  const [riskFilter, setRiskFilter] =
    useState("All");

  const [sourceFilter, setSourceFilter] =
    useState("All");

  useEffect(() => {
    loadFindings();
  }, []);

  useEffect(() => {
    const clientId =
      searchParams.get("clientId") ||
      "All";

    const datasetId =
      searchParams.get("datasetId") ||
      "All";

    const analysisId =
      searchParams.get("analysisId") ||
      "All";

    setClientFilter(clientId);
    setDatasetFilter(datasetId);
    setAnalysisFilter(analysisId);
  }, [searchParams]);

  const loadFindings = async () => {
    try {
      setLoading(true);

      const data =
        await getAllFindings();

      setFindings(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Failed to load findings."
      );
    } finally {
      setLoading(false);
    }
  };

  const clients = useMemo(() => {
    const map = new Map();

    findings.forEach((finding) => {
      const client =
        finding.analyses
          ?.datasets
          ?.clients;

      if (client?.id) {
        map.set(
          String(client.id),
          client
        );
      }
    });

    return Array.from(
      map.values()
    ).sort((a, b) =>
      String(
        a.client_name || ""
      ).localeCompare(
        String(
          b.client_name || ""
        )
      )
    );
  }, [findings]);

  const datasets = useMemo(() => {
    const map = new Map();

    findings.forEach((finding) => {
      const dataset =
        finding.analyses
          ?.datasets;

      if (dataset?.id) {
        map.set(
          String(dataset.id),
          dataset
        );
      }
    });

    return Array.from(
      map.values()
    ).sort((a, b) =>
      String(
        a.dataset_name || ""
      ).localeCompare(
        String(
          b.dataset_name || ""
        )
      )
    );
  }, [findings]);

  const analyses = useMemo(() => {
    const map = new Map();

    findings.forEach((finding) => {
      const analysis =
        finding.analyses;

      if (analysis?.id) {
        map.set(
          String(analysis.id),
          analysis
        );
      }
    });

    return Array.from(
      map.values()
    ).sort(
      (a, b) =>
        new Date(
          b.created_at || 0
        ) -
        new Date(
          a.created_at || 0
        )
    );
  }, [findings]);

  const availableDatasets =
    useMemo(() => {
      if (
        clientFilter === "All"
      ) {
        return datasets;
      }

      return datasets.filter(
        (dataset) =>
          String(
            dataset.client_id
          ) ===
          String(clientFilter)
      );
    }, [
      datasets,
      clientFilter,
    ]);

  const availableAnalyses =
    useMemo(() => {
      return analyses.filter(
        (analysis) => {
          const dataset =
            analysis.datasets;

          const matchesClient =
            clientFilter === "All" ||
            String(
              dataset?.client_id ||
                analysis.client_id
            ) ===
              String(
                clientFilter
              );

          const matchesDataset =
            datasetFilter === "All" ||
            String(
              analysis.dataset_id
            ) ===
              String(
                datasetFilter
              );

          return (
            matchesClient &&
            matchesDataset
          );
        }
      );
    }, [
      analyses,
      clientFilter,
      datasetFilter,
    ]);

  const selectedClient =
    clients.find(
      (client) =>
        String(client.id) ===
        String(clientFilter)
    );

  const selectedDataset =
    datasets.find(
      (dataset) =>
        String(dataset.id) ===
        String(datasetFilter)
    );

  const selectedAnalysis =
    analyses.find(
      (analysis) =>
        String(analysis.id) ===
        String(analysisFilter)
    );

  const updateContextUrl = ({
    clientId = clientFilter,
    datasetId = datasetFilter,
    analysisId = analysisFilter,
  }) => {
    const params = {};

    if (clientId !== "All") {
      params.clientId = clientId;
    }

    if (datasetId !== "All") {
      params.datasetId = datasetId;
    }

    if (analysisId !== "All") {
      params.analysisId =
        analysisId;
    }

    setSearchParams(
      params,
      {
        replace: true,
      }
    );
  };

  const filteredFindings =
    useMemo(() => {
      return findings.filter(
        (finding) => {
          const analysis =
            finding.analyses;

          const dataset =
            analysis?.datasets;

          const client =
            dataset?.clients;

          const sources =
            Array.isArray(
              finding.detection_sources
            )
              ? finding
                  .detection_sources
              : [];

          const searchableText = [
            finding.transaction_id,
            finding.risk_level,
            finding.reasons,
            client?.client_name,
            client?.client_code,
            dataset?.dataset_name,
            Array.isArray(
              finding.triggered_rules
            )
              ? finding
                  .triggered_rules
                  .join(" ")
              : "",
            Array.isArray(
              finding.anomaly_reasons
            )
              ? finding
                  .anomaly_reasons
                  .join(" ")
              : "",
            sources.join(" "),
          ]
            .join(" ")
            .toLowerCase();

          return (
            searchableText.includes(
              search.toLowerCase()
            ) &&
            (
              clientFilter ===
                "All" ||
              String(client?.id) ===
                String(clientFilter)
            ) &&
            (
              datasetFilter ===
                "All" ||
              String(dataset?.id) ===
                String(datasetFilter)
            ) &&
            (
              analysisFilter ===
                "All" ||
              String(analysis?.id) ===
                String(analysisFilter)
            ) &&
            (
              riskFilter ===
                "All" ||
              finding.risk_level ===
                riskFilter
            ) &&
            (
              sourceFilter ===
                "All" ||
              sources.includes(
                sourceFilter
              )
            )
          );
        }
      );
    }, [
      findings,
      search,
      clientFilter,
      datasetFilter,
      analysisFilter,
      riskFilter,
      sourceFilter,
    ]);

  const statistics = useMemo(() => {
    const total =
      filteredFindings.length;

    const high =
      filteredFindings.filter(
        (finding) =>
          finding.risk_level ===
          "High"
      ).length;

    const critical =
      filteredFindings.filter(
        (finding) =>
          finding.risk_level ===
          "Critical"
      ).length;

    const ml =
      filteredFindings.filter(
        (finding) =>
          Array.isArray(
            finding.detection_sources
          ) &&
          finding
            .detection_sources
            .includes("ML")
      ).length;

    const networkFindings =
      filteredFindings.filter(
        (finding) =>
          Array.isArray(
            finding.detection_sources
          ) &&
          finding
            .detection_sources
            .includes("NETWORK")
      );

    const averageRisk =
      total === 0
        ? 0
        : Math.round(
            filteredFindings.reduce(
              (sum, finding) =>
                sum +
                Number(
                  finding.risk_score ||
                    0
                ),
              0
            ) / total
          );

    const highestNetworkScore =
      networkFindings.length === 0
        ? 0
        : Math.max(
            ...networkFindings.map(
              (finding) =>
                Number(
                  finding.network_score ||
                    0
                )
            )
          );

    const sharedNetworkReasons =
      new Set();

    networkFindings.forEach(
      (finding) => {
        const reasons =
          finding.explanation
            ?.network_reasons ||
          [];

        if (Array.isArray(reasons)) {
          reasons.forEach(
            (reason) =>
              sharedNetworkReasons.add(
                reason
              )
          );
        }
      }
    );

    return {
      total,
      high,
      critical,
      ml,
      network:
        networkFindings.length,
      averageRisk,
      highestNetworkScore,
      networkEvidence:
        sharedNetworkReasons.size,
    };
  }, [filteredFindings]);

  const resetFilters = () => {
    setSearch("");
    setClientFilter("All");
    setDatasetFilter("All");
    setAnalysisFilter("All");
    setRiskFilter("All");
    setSourceFilter("All");
    setExpandedId(null);

    setSearchParams(
      {},
      {
        replace: true,
      }
    );
  };

  const openNetworkGraph = () => {
    if (
      datasetFilter === "All"
    ) {
      alert(
        "Select a dataset before opening the network graph."
      );

      return;
    }

    setNetworkModalOpen(true);
  };

  return (
    <div>
      <h1 className="page-title">
        Findings Investigation
      </h1>

      <p className="page-subtitle">
        Investigate audit findings,
        anomaly evidence, and network
        relationships by client,
        dataset, and analysis run.
      </p>

      <div className="nav-actions">
        <button
          className="secondary-btn"
          onClick={() =>
            navigate("/analysis")
          }
        >
          ← Back to Analysis
        </button>

        <button
          className="secondary-btn"
          onClick={() =>
            navigate(
              clientFilter !== "All"
                ? `/datasets?clientId=${clientFilter}`
                : "/datasets"
            )
          }
        >
          View Datasets
        </button>

        <button
          className="primary-btn"
          onClick={() =>
            navigate("/reports")
          }
        >
          Generate Report →
        </button>
      </div>

      {(selectedClient ||
        selectedDataset ||
        selectedAnalysis) && (
        <div className="preview-box">
          <strong>
            Current Investigation
            Context
          </strong>

          <p style={{ marginBottom: 0 }}>
            Client:{" "}
            {selectedClient
              ?.client_name ||
              "All"}
            {" • "}
            Dataset:{" "}
            {selectedDataset
              ?.dataset_name ||
              "All"}
            {" • "}
            Analysis:{" "}
            {selectedAnalysis
              ? shortId(
                  selectedAnalysis.id
                )
              : "All"}
          </p>
        </div>
      )}

      <div style={statsGridStyle}>
        <StatCard
          title="Filtered Findings"
          value={statistics.total}
        />

        <StatCard
          title="High Risk"
          value={statistics.high}
        />

        <StatCard
          title="Critical"
          value={statistics.critical}
        />

        <StatCard
          title="ML Findings"
          value={statistics.ml}
        />

        <StatCard
          title="Network Findings"
          value={statistics.network}
        />

        <StatCard
          title="Average Risk"
          value={
            statistics.averageRisk
          }
        />
      </div>

      <div
        className="card"
        style={{ marginTop: "24px" }}
      >
        <h2 style={{ marginTop: 0 }}>
          Context Filters
        </h2>

        <div className="form-grid">
          <input
            placeholder="Search transaction, client, dataset, rule or reason..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

          <select
            value={clientFilter}
            onChange={(event) => {
              const value =
                event.target.value;

              setClientFilter(value);
              setDatasetFilter("All");
              setAnalysisFilter("All");

              updateContextUrl({
                clientId: value,
                datasetId: "All",
                analysisId: "All",
              });
            }}
          >
            <option value="All">
              All Clients
            </option>

            {clients.map(
              (client) => (
                <option
                  key={client.id}
                  value={client.id}
                >
                  {client.client_code ||
                    "NO-CODE"}
                  {" - "}
                  {client.client_name}
                </option>
              )
            )}
          </select>

          <select
            value={datasetFilter}
            onChange={(event) => {
              const value =
                event.target.value;

              setDatasetFilter(value);
              setAnalysisFilter("All");

              updateContextUrl({
                datasetId: value,
                analysisId: "All",
              });
            }}
          >
            <option value="All">
              All Datasets
            </option>

            {availableDatasets.map(
              (dataset) => (
                <option
                  key={dataset.id}
                  value={dataset.id}
                >
                  {dataset.dataset_name}
                </option>
              )
            )}
          </select>

          <select
            value={analysisFilter}
            onChange={(event) => {
              const value =
                event.target.value;

              setAnalysisFilter(value);

              updateContextUrl({
                analysisId: value,
              });
            }}
          >
            <option value="All">
              All Analysis Runs
            </option>

            {availableAnalyses.map(
              (analysis) => (
                <option
                  key={analysis.id}
                  value={analysis.id}
                >
                  {shortId(
                    analysis.id
                  )}
                  {" • "}
                  {formatDate(
                    analysis.created_at
                  )}
                </option>
              )
            )}
          </select>

          <select
            value={riskFilter}
            onChange={(event) =>
              setRiskFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All Risk Levels
            </option>

            <option value="Low">
              Low
            </option>

            <option value="Medium">
              Medium
            </option>

            <option value="High">
              High
            </option>

            <option value="Critical">
              Critical
            </option>
          </select>

          <select
            value={sourceFilter}
            onChange={(event) =>
              setSourceFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All Detection Sources
            </option>

            <option value="RULE">
              Rule Engine
            </option>

            <option value="ML">
              ML Engine
            </option>

            <option value="NETWORK">
              Network Engine
            </option>
          </select>
        </div>

        <div className="nav-actions">
          <button
            className="secondary-btn"
            onClick={resetFilters}
          >
            Reset Filters
          </button>

          <button
            className="secondary-btn"
            onClick={loadFindings}
          >
            Refresh Findings
          </button>
        </div>
      </div>

      {datasetFilter !== "All" && (
        <div
          className="card"
          style={{
            marginTop: "24px",
          }}
        >
          <div style={networkCardHeaderStyle}>
            <div>
              <h2 style={{ margin: 0 }}>
                Network Intelligence
              </h2>

              <p style={networkSubtitleStyle}>
                Relationship evidence for
                the selected dataset.
              </p>
            </div>

            <button
              className="primary-btn"
              onClick={openNetworkGraph}
            >
              Open Interactive Graph
            </button>
          </div>

          <div style={networkStatsStyle}>
            <MiniStat
              label="Network Findings"
              value={
                statistics.network
              }
            />

            <MiniStat
              label="Highest Network Score"
              value={
                statistics
                  .highestNetworkScore
              }
            />

            <MiniStat
              label="Network Evidence"
              value={
                statistics
                  .networkEvidence
              }
            />

            <MiniStat
              label="Selected Dataset"
              value={
                selectedDataset
                  ?.dataset_name ||
                "-"
              }
            />
          </div>

          {statistics.network ===
          0 ? (
            <div style={networkEmptyStyle}>
              No network findings are
              currently stored for this
              filtered context. Open the
              graph to inspect whether the
              dataset contains relationship
              identifiers.
            </div>
          ) : (
            <div style={networkSuccessStyle}>
              Network relationship evidence
              is available. Open the graph to
              inspect connected vendors and
              shared identifiers.
            </div>
          )}
        </div>
      )}

      <div
        className="card"
        style={{ marginTop: "24px" }}
      >
        <h2 style={{ marginTop: 0 }}>
          Findings
        </h2>

        {loading && (
          <p>
            Loading findings...
          </p>
        )}

        {!loading &&
          filteredFindings.length ===
            0 && (
            <p style={mutedTextStyle}>
              No findings match the
              selected filters.
            </p>
          )}

        {!loading &&
          filteredFindings.map(
            (finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                expanded={
                  expandedId ===
                  finding.id
                }
                onToggle={() =>
                  setExpandedId(
                    expandedId ===
                      finding.id
                      ? null
                      : finding.id
                  )
                }
              />
            )
          )}
      </div>

      <NetworkGraphModal
        open={networkModalOpen}
        onClose={() =>
          setNetworkModalOpen(false)
        }
        datasetId={
          datasetFilter !== "All"
            ? datasetFilter
            : null
        }
        datasetName={
          selectedDataset
            ?.dataset_name
        }
        clientName={
          selectedClient
            ?.client_name
        }
      />
    </div>
  );
}


function FindingCard({
  finding,
  expanded,
  onToggle,
}) {
  const analysis =
    finding.analyses;

  const dataset =
    analysis?.datasets;

  const client =
    dataset?.clients;

  const sources =
    Array.isArray(
      finding.detection_sources
    )
      ? finding.detection_sources
      : [];

  const reasons =
    splitReasons(
      finding.reasons
    );

  const networkReasons =
    finding.explanation
      ?.network_reasons || [];

  return (
    <div
      className="card"
      style={findingCardStyle}
    >
      <div style={findingTopStyle}>
        <div>
          <h3 style={{ margin: 0 }}>
            Transaction{" "}
            {finding.transaction_id ||
              "-"}
          </h3>

          <p style={findingContextStyle}>
            <strong>Client:</strong>{" "}
            {client?.client_name || "-"}
            {" • "}
            <strong>Dataset:</strong>{" "}
            {dataset?.dataset_name || "-"}
            {" • "}
            <strong>Analysis:</strong>{" "}
            {shortId(analysis?.id)}
          </p>

          <div style={sourceRowStyle}>
            {sources.length === 0 ? (
              <span style={mutedTextStyle}>
                No detection source
              </span>
            ) : (
              sources.map((source) => (
                <span
                  key={source}
                  className={getSourceBadgeClass(
                    source
                  )}
                >
                  {source}
                </span>
              ))
            )}
          </div>
        </div>

        <span
          className={getRiskBadgeClass(
            finding.risk_level
          )}
        >
          {finding.risk_level ||
            "Low"}
        </span>
      </div>

      <div style={scoreGridStyle}>
        <ScoreBox
          label="Rule Score"
          value={
            finding.rule_score ?? 0
          }
        />

        <ScoreBox
          label="ML Score"
          value={
            finding.anomaly_score ?? 0
          }
        />

        <ScoreBox
          label="Network Score"
          value={
            finding.network_score ?? 0
          }
        />

        <ScoreBox
          label="Final Risk Score"
          value={
            finding.risk_score ?? 0
          }
        />
      </div>

      <div style={summaryStyle}>
        <strong>
          Primary Reason:
        </strong>{" "}
        {reasons[0] ||
          "No reason available."}
      </div>

      <div className="nav-actions">
        <button
          className="secondary-btn"
          onClick={onToggle}
        >
          {expanded
            ? "Hide Details"
            : "View Details"}
        </button>
      </div>

      {expanded && (
        <div style={detailStyle}>
          <h4>
            Triggered Rules
          </h4>

          {Array.isArray(
            finding.triggered_rules
          ) &&
          finding.triggered_rules
            .length > 0 ? (
            <ul>
              {finding.triggered_rules.map(
                (rule, index) => (
                  <li key={index}>
                    {rule}
                  </li>
                )
              )}
            </ul>
          ) : (
            <p>-</p>
          )}

          <h4>
            Combined Reasons
          </h4>

          {reasons.length > 0 ? (
            <ul>
              {reasons.map(
                (reason, index) => (
                  <li key={index}>
                    {reason}
                  </li>
                )
              )}
            </ul>
          ) : (
            <p>-</p>
          )}

          <h4>
            ML Explanations
          </h4>

          {Array.isArray(
            finding.anomaly_reasons
          ) &&
          finding.anomaly_reasons
            .length > 0 ? (
            <ul>
              {finding.anomaly_reasons.map(
                (reason, index) => (
                  <li key={index}>
                    {reason}
                  </li>
                )
              )}
            </ul>
          ) : (
            <p>-</p>
          )}

          <h4>
            Network Explanations
          </h4>

          {Array.isArray(
            networkReasons
          ) &&
          networkReasons.length >
            0 ? (
            <ul>
              {networkReasons.map(
                (reason, index) => (
                  <li key={index}>
                    {reason}
                  </li>
                )
              )}
            </ul>
          ) : (
            <p>-</p>
          )}
        </div>
      )}
    </div>
  );
}


function StatCard({
  title,
  value,
}) {
  return (
    <div className="card">
      <p style={statLabelStyle}>
        {title}
      </p>

      <h2 style={statValueStyle}>
        {value}
      </h2>
    </div>
  );
}


function MiniStat({
  label,
  value,
}) {
  return (
    <div style={miniStatStyle}>
      <p style={miniStatLabelStyle}>
        {label}
      </p>

      <strong>
        {value}
      </strong>
    </div>
  );
}


function ScoreBox({
  label,
  value,
}) {
  return (
    <div style={scoreBoxStyle}>
      <p style={scoreLabelStyle}>
        {label}
      </p>

      <strong
        style={{
          fontSize: "22px",
        }}
      >
        {Number(value)}
      </strong>
    </div>
  );
}


function splitReasons(
  reasons
) {
  if (!reasons) {
    return [];
  }

  return String(reasons)
    .split("|")
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}


function getRiskBadgeClass(
  riskLevel
) {
  if (
    riskLevel === "Critical"
  ) {
    return "badge badge-critical";
  }

  if (riskLevel === "High") {
    return "badge badge-high";
  }

  if (
    riskLevel === "Medium"
  ) {
    return "badge badge-medium";
  }

  return "badge badge-low";
}


function getSourceBadgeClass(
  source
) {
  if (source === "NETWORK") {
    return "badge badge-critical";
  }

  if (source === "ML") {
    return "badge badge-low";
  }

  return "badge badge-medium";
}


function shortId(value) {
  if (!value) {
    return "-";
  }

  return String(value).slice(
    0,
    8
  );
}


function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(
    value
  ).toLocaleString();
}


const statsGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "16px",
};


const networkCardHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
};


const networkSubtitleStyle = {
  margin: "6px 0 0",
  color: "#6B7280",
};


const networkStatsStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "12px",
  marginTop: "18px",
};


const miniStatStyle = {
  padding: "14px",
  borderRadius: "14px",
  background: "#F8FAFC",
  border: "1px solid #E5E7EB",
};


const miniStatLabelStyle = {
  margin: "0 0 6px",
  color: "#64748B",
  fontSize: "12px",
};


const networkEmptyStyle = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "14px",
  background: "#FFF7ED",
  border: "1px solid #FDBA74",
  color: "#9A3412",
};


const networkSuccessStyle = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "14px",
  background: "#ECFDF5",
  border: "1px solid #86EFAC",
  color: "#166534",
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


const findingContextStyle = {
  color: "#6B7280",
  margin: "6px 0 0",
};


const sourceRowStyle = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
  marginTop: "10px",
};


const scoreGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
  marginTop: "18px",
};


const scoreBoxStyle = {
  background: "#F8F9FC",
  border: "1px solid #E5E7EB",
  borderRadius: "16px",
  padding: "14px",
};


const scoreLabelStyle = {
  margin: 0,
  color: "#6B7280",
  fontSize: "12px",
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


const mutedTextStyle = {
  color: "#6B7280",
};


const statLabelStyle = {
  color: "#6B7280",
  margin: 0,
};


const statValueStyle = {
  margin: "8px 0 0",
  fontSize: "30px",
};