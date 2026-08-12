import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  exportReport,
  getReportContext,
  previewReport,
} from "../services/reportService";

import "./ReportsPage.css";


const REPORT_TYPES = [
  {
    value: "executive",
    label: "Executive Report",
    description:
      "Management-level summary using the current assessment of every dataset in scope.",
  },
  {
    value: "client",
    label: "Client Audit Report",
    description:
      "Consolidated current audit position for one client.",
  },
  {
    value: "dataset",
    label: "Dataset Audit Report",
    description:
      "Detailed report using the latest completed assessment of one dataset.",
  },
  {
    value: "investigation",
    label: "Investigation Report",
    description:
      "Detailed finding-level report for the current assessment of one dataset.",
  },
];


export default function ReportsPage() {
  const [context, setContext] =
    useState({
      clients: [],
      datasets: [],
      analyses: [],
    });

  const [reportType, setReportType] =
    useState("executive");

  const [clientId, setClientId] =
    useState("All");

  const [datasetId, setDatasetId] =
    useState("All");

  const [riskLevel, setRiskLevel] =
    useState("All");

  const [preview, setPreview] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [exporting, setExporting] =
    useState("");

  useEffect(() => {
    loadContext();
  }, []);

  const loadContext =
    async () => {
      try {
        setLoading(true);

        const data =
          await getReportContext();

        setContext({
          clients:
            Array.isArray(
              data?.clients
            )
              ? data.clients
              : [],
          datasets:
            Array.isArray(
              data?.datasets
            )
              ? data.datasets
              : [],
          analyses:
            Array.isArray(
              data?.analyses
            )
              ? data.analyses
              : [],
        });
      } catch (error) {
        console.error(error);

        alert(
          error?.response?.data
            ?.detail ||
            "Failed to load report context."
        );
      } finally {
        setLoading(false);
      }
    };

  const availableDatasets =
    useMemo(() => {
      if (
        clientId === "All"
      ) {
        return context.datasets;
      }

      return context.datasets.filter(
        (dataset) =>
          String(
            dataset.client_id
          ) === String(
            clientId
          )
      );
    }, [
      context.datasets,
      clientId,
    ]);

  const currentAssessment =
    useMemo(() => {
      if (
        datasetId === "All"
      ) {
        return null;
      }

      return context.analyses.find(
        (item) =>
          String(
            item.dataset_id
          ) === String(
            datasetId
          )
      );
    }, [
      context.analyses,
      datasetId,
    ]);

  const params =
    useMemo(
      () => ({
        report_type:
          reportType,
        client_id:
          clientId === "All"
            ? undefined
            : clientId,
        dataset_id:
          datasetId === "All"
            ? undefined
            : datasetId,
        risk_level:
          riskLevel === "All"
            ? undefined
            : riskLevel,
      }),
      [
        reportType,
        clientId,
        datasetId,
        riskLevel,
      ]
    );

  const validateSelection =
    () => {
      if (
        reportType ===
          "client" &&
        clientId === "All"
      ) {
        alert(
          "Select a client for the Client Audit Report."
        );
        return false;
      }

      if (
        [
          "dataset",
          "investigation",
        ].includes(
          reportType
        ) &&
        datasetId === "All"
      ) {
        alert(
          "Select a dataset. The report will automatically use its latest completed assessment."
        );
        return false;
      }

      if (
        [
          "dataset",
          "investigation",
        ].includes(
          reportType
        ) &&
        !currentAssessment
      ) {
        alert(
          "This dataset does not have a completed current assessment yet."
        );
        return false;
      }

      return true;
    };

  const handlePreview =
    async () => {
      if (
        !validateSelection()
      ) {
        return;
      }

      try {
        setLoading(true);

        const data =
          await previewReport(
            params
          );

        setPreview(data);
      } catch (error) {
        console.error(error);

        alert(
          error?.response?.data
            ?.detail ||
            "Failed to generate report preview."
        );
      } finally {
        setLoading(false);
      }
    };

  const handleExport =
    async (format) => {
      if (
        !validateSelection()
      ) {
        return;
      }

      try {
        setExporting(
          format
        );

        await exportReport(
          format,
          params
        );
      } catch (error) {
        console.error(error);

        alert(
          "Failed to export report."
        );
      } finally {
        setExporting("");
      }
    };

  const reset = () => {
    setReportType(
      "executive"
    );
    setClientId("All");
    setDatasetId("All");
    setRiskLevel("All");
    setPreview(null);
  };

  return (
    <div className="reports-page">
      <header className="reports-header">
        <div className="reports-header-copy">
          <h1>
            Internal Audit
            Reports
          </h1>

          <p>
            Reports automatically
            use the current completed
            assessment of each dataset.
            Historical executions are
            not shown as competing
            audit results.
          </p>
        </div>

        <span className="report-draft-badge">
          Draft for Auditor
          Review
        </span>
      </header>

      <div className="reports-standard-note">
        <strong>
          Reporting approach:
        </strong>{" "}
        The report structure is
        aligned to ICAI internal
        audit reporting principles
        and is generated from the
        selected current audit
        assessment.
      </div>

      <div className="reports-layout">
        <aside className="report-builder-card">
          <h2>
            Report Builder
          </h2>

          <div className="report-form-section">
            <label>
              Report Type
            </label>

            <div className="report-type-grid">
              {REPORT_TYPES.map(
                (item) => (
                  <button
                    key={
                      item.value
                    }
                    type="button"
                    className={
                      reportType ===
                      item.value
                        ? "report-type-option active"
                        : "report-type-option"
                    }
                    onClick={() => {
                      setReportType(
                        item.value
                      );
                      setPreview(
                        null
                      );
                    }}
                  >
                    <span>
                      {item.label}
                    </span>

                    <small>
                      {
                        item.description
                      }
                    </small>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="report-form-section">
            <label>
              Client
            </label>

            <select
              value={clientId}
              onChange={(
                event
              ) => {
                setClientId(
                  event.target.value
                );
                setDatasetId(
                  "All"
                );
                setPreview(
                  null
                );
              }}
            >
              <option value="All">
                All Clients
              </option>

              {context.clients.map(
                (client) => (
                  <option
                    key={
                      client.id
                    }
                    value={
                      client.id
                    }
                  >
                    {client.client_code ||
                      "NO-CODE"}
                    {" - "}
                    {
                      client.client_name
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div className="report-form-section">
            <label>
              Dataset
            </label>

            <select
              value={datasetId}
              onChange={(
                event
              ) => {
                setDatasetId(
                  event.target.value
                );
                setPreview(
                  null
                );
              }}
            >
              <option value="All">
                All Datasets
              </option>

              {availableDatasets.map(
                (dataset) => (
                  <option
                    key={
                      dataset.id
                    }
                    value={
                      dataset.id
                    }
                  >
                    {
                      dataset.dataset_name
                    }
                  </option>
                )
              )}
            </select>

            {datasetId !==
              "All" && (
              <div
                style={{
                  marginTop:
                    "7px",
                  fontSize:
                    "12px",
                  color:
                    currentAssessment
                      ? "#166534"
                      : "#b45309",
                }}
              >
                {currentAssessment
                  ? (
                      `Current assessment: ${formatDate(
                        currentAssessment
                          .created_at
                      )}`
                    )
                  : (
                      "No completed assessment is available for this dataset."
                    )}
              </div>
            )}
          </div>

          <div className="report-form-section">
            <label>
              Risk Level
            </label>

            <select
              value={riskLevel}
              onChange={(
                event
              ) => {
                setRiskLevel(
                  event.target.value
                );
                setPreview(
                  null
                );
              }}
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
          </div>

          <div className="report-actions">
            <button
              className="primary-btn"
              onClick={
                handlePreview
              }
              disabled={
                loading
              }
            >
              {loading
                ? "Generating..."
                : "Generate Preview"}
            </button>

            <div className="report-export-grid">
              {[
                "pdf",
                "xlsx",
                "csv",
                "json",
              ].map(
                (format) => (
                  <button
                    key={
                      format
                    }
                    className="secondary-btn"
                    onClick={() =>
                      handleExport(
                        format
                      )
                    }
                    disabled={
                      Boolean(
                        exporting
                      )
                    }
                  >
                    {exporting ===
                    format
                      ? "Exporting..."
                      : format.toUpperCase()}
                  </button>
                )
              )}
            </div>

            <button
              className="secondary-btn"
              onClick={reset}
            >
              Reset
            </button>
          </div>
        </aside>

        <section className="report-preview-card">
          <header className="report-preview-header">
            <div>
              <h2>
                {preview
                  ?.report_title ||
                  "Report Preview"}
              </h2>

              <p>
                {preview
                  ? (
                      `Generated ${formatDate(
                        preview
                          .generated_at
                      )}`
                    )
                  : (
                      "Select the report scope and generate a preview."
                    )}
              </p>
            </div>
          </header>

          {loading && (
            <div className="report-loading-state">
              Building report...
            </div>
          )}

          {!loading &&
            !preview && (
              <div className="report-empty-state">
                No preview
                generated.
              </div>
            )}

          {!loading &&
            preview && (
              <ReportPreview
                report={
                  preview
                }
              />
            )}
        </section>
      </div>
    </div>
  );
}


function ReportPreview({
  report,
}) {
  const summary =
    report.summary || {};

  const riskCounts =
    summary.risk_counts ||
    {};

  return (
    <div className="report-preview-body">
      <section className="report-document-cover">
        <span>
          INTERNAL AUDIT
          ANALYTICS
        </span>

        <h2>
          {
            report.report_title
          }
        </h2>

        <p>
          {report.clients
            ?.length === 1
            ? report.clients[0]
                .client_name
            : "Selected Audit Scope"}
        </p>
      </section>

      <section className="report-section">
        <h3>
          1. Engagement
          Overview
        </h3>

        <p className="report-narrative">
          {
            report.engagement
              ?.objective
          }
        </p>

        <p className="report-narrative">
          {
            report.engagement
              ?.scope
          }
        </p>
      </section>

      <section className="report-section">
        <h3>
          2. Executive Summary
        </h3>

        <p className="report-narrative">
          {
            report.executive_summary
          }
        </p>

        <div className="report-summary-grid">
          <SummaryCard
            label="Transactions Reviewed"
            value={
              summary
                .total_transactions
            }
          />

          <SummaryCard
            label="Require Review"
            value={
              summary
                .transactions_requiring_review
            }
          />

          <SummaryCard
            label="High"
            value={
              riskCounts.High ||
              0
            }
          />

          <SummaryCard
            label="Critical"
            value={
              riskCounts.Critical ||
              0
            }
          />
        </div>
      </section>

      <section className="report-section">
        <h3>
          3. Risk Assessment
          Summary
        </h3>

        <div className="report-risk-grid">
          {[
            "Low",
            "Medium",
            "High",
            "Critical",
          ].map(
            (level) => (
              <div
                key={
                  level
                }
                className={`report-risk-metric ${level.toLowerCase()}`}
              >
                <span>
                  {level}
                </span>

                <strong>
                  {riskCounts[
                    level
                  ] || 0}
                </strong>
              </div>
            )
          )}
        </div>
      </section>

      <section className="report-section">
        <h3>
          4. Key Audit
          Observations
        </h3>

        {report
          .audit_observations
          ?.length ? (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>
                    Observation /
                    Audit Check
                  </th>
                  <th>
                    Occurrences
                  </th>
                </tr>
              </thead>

              <tbody>
                {report
                  .audit_observations
                  .map(
                    (item) => (
                      <tr
                        key={
                          item.observation
                        }
                      >
                        <td>
                          {
                            item.observation
                          }
                        </td>
                        <td>
                          {
                            item.count
                          }
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            No configured audit
            check was triggered.
          </p>
        )}
      </section>

      <section className="report-section">
        <h3>
          5. Recommended
          Corrective Actions
        </h3>

        <ol className="report-recommendations">
          {(
            report.recommendations ||
            []
          ).map(
            (
              item,
              index
            ) => (
              <li
                key={
                  index
                }
              >
                {item}
              </li>
            )
          )}
        </ol>
      </section>

      <section className="report-section">
        <h3>
          6. Detailed
          Findings
        </h3>

        {report.findings
          ?.length ? (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>
                    Transaction
                  </th>
                  <th>
                    Risk
                  </th>
                  <th>
                    Score
                  </th>
                  <th>
                    Audit Observation
                  </th>
                  <th>
                    Supporting Reason
                  </th>
                </tr>
              </thead>

              <tbody>
                {report.findings
                  .slice(0, 100)
                  .map(
                    (
                      finding
                    ) => (
                      <tr
                        key={
                          finding.id
                        }
                      >
                        <td>
                          {
                            finding.transaction_id
                          }
                        </td>
                        <td>
                          {
                            finding.risk_level
                          }
                        </td>
                        <td>
                          {
                            finding.risk_score
                          }
                        </td>
                        <td>
                          {
                            finding.primary_observation
                          }
                        </td>
                        <td>
                          {firstReason(
                            finding.reasons
                          )}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            No findings match
            this scope.
          </p>
        )}
      </section>

      <section className="report-section">
        <h3>
          7. Methodology &
          Limitations
        </h3>

        <p className="report-narrative">
          {
            report.methodology_note
          }
        </p>

        <p className="report-standard-footnote">
          {
            report.standards_note
          }
        </p>
      </section>
    </div>
  );
}


function SummaryCard({
  label,
  value,
}) {
  return (
    <div className="report-summary-card">
      <span>
        {label}
      </span>

      <strong>
        {value ?? 0}
      </strong>
    </div>
  );
}


function firstReason(
  value
) {
  if (
    Array.isArray(value)
  ) {
    return value[0] || "-";
  }

  return String(
    value || "-"
  )
    .split("|")[0]
    .trim();
}


function formatDate(
  value
) {
  if (!value) {
    return "-";
  }

  return new Date(
    value
  ).toLocaleString();
}
