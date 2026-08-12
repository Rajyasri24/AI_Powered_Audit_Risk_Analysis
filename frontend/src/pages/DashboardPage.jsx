import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getDashboardSummary,
} from "../services/dashboardService";


const RISK_COLORS = {
  Low: "#4F8F83",
  Medium: "#CF8A52",
  High: "#C75C72",
  Critical: "#7C3AED",
};


export default function DashboardPage() {
  const navigate = useNavigate();

  const [summary, setSummary] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    clientFilter,
    setClientFilter,
  ] = useState("All");

  const [
    datasetFilter,
    setDatasetFilter,
  ] = useState("All");

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const data =
        await getDashboardSummary();

      setSummary(data);
    } catch (error) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Failed to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  const availableDatasets =
    useMemo(() => {
      const datasets =
        summary?.datasets || [];

      if (
        clientFilter === "All"
      ) {
        return datasets;
      }

      return datasets.filter(
        (dataset) =>
          String(
            dataset.client_id
          ) === String(
            clientFilter
          )
      );
    }, [
      summary,
      clientFilter,
    ]);

  const selectedClient =
    useMemo(
      () =>
        (
          summary?.clients || []
        ).find(
          (client) =>
            String(client.id) ===
            String(clientFilter)
        ),
      [
        summary,
        clientFilter,
      ]
    );

  const clientRows =
    useMemo(() => {
      const rows =
        summary?.client_overview ||
        [];

      if (
        clientFilter === "All"
      ) {
        return rows;
      }

      return rows.filter(
        (item) =>
          String(
            item.client_id
          ) === String(
            clientFilter
          )
      );
    }, [
      summary,
      clientFilter,
    ]);

  const currentAssessments =
    useMemo(() => {
      return (
        summary?.recent_assessments ||
        summary?.recent_analyses ||
        []
      ).filter(
        (assessment) => {
          const clientMatches =
            clientFilter === "All" ||
            String(
              assessment.client_id
            ) === String(
              clientFilter
            );

          const datasetMatches =
            datasetFilter === "All" ||
            String(
              assessment.dataset_id
            ) === String(
              datasetFilter
            );

          return (
            clientMatches &&
            datasetMatches
          );
        }
      );
    }, [
      summary,
      clientFilter,
      datasetFilter,
    ]);

  const selectedFindings =
    useMemo(() => {
      return (
        summary?.findings || []
      ).filter(
        (finding) => {
          const clientMatches =
            clientFilter === "All" ||
            String(
              finding.client_id
            ) === String(
              clientFilter
            );

          const datasetMatches =
            datasetFilter === "All" ||
            String(
              finding.dataset_id
            ) === String(
              datasetFilter
            );

          return (
            clientMatches &&
            datasetMatches
          );
        }
      );
    }, [
      summary,
      clientFilter,
      datasetFilter,
    ]);

  const riskData =
    useMemo(() => {
      const counts = {
        Low: 0,
        Medium: 0,
        High: 0,
        Critical: 0,
      };

      selectedFindings.forEach(
        (finding) => {
          const level =
            finding.risk_level;

          if (
            Object.prototype
              .hasOwnProperty.call(
                counts,
                level
              )
          ) {
            counts[level] += 1;
          }
        }
      );

      return [
        "Low",
        "Medium",
        "High",
        "Critical",
      ].map(
        (name) => ({
          name,
          value: counts[name],
        })
      );
    }, [selectedFindings]);

  const clientWorkloadData =
    useMemo(
      () =>
        (
          summary?.client_overview ||
          []
        ).map(
          (item) => ({
            client:
              item.client_code ||
              item.client_name,
            reviewed: Number(
              item.transactions_reviewed ||
              0
            ),
            findings: Number(
              item.findings || 0
            ),
            reviewRequired:
              Number(
                item.review_required ||
                0
              ),
            critical: Number(
              item.critical_findings ||
              0
            ),
            reviewRate: Number(
              item.review_rate || 0
            ),
            low: Number(
              item.risk_counts?.Low ||
              0
            ),
            medium: Number(
              item.risk_counts
                ?.Medium || 0
            ),
            high: Number(
              item.risk_counts?.High ||
              0
            ),
          })
        ),
      [summary]
    );

  const assessmentChartData =
    useMemo(
      () =>
        currentAssessments
          .slice()
          .reverse()
          .slice(-8)
          .map(
            (item) => ({
              label: shortName(
                item.dataset_name
              ),
              reviewed: Number(
                item.total_transactions ||
                0
              ),
              low: Number(
                item.low_risk_count ||
                0
              ),
              medium: Number(
                item.medium_risk_count ||
                0
              ),
              high: Number(
                item.high_only_count ||
                0
              ),
              critical: Number(
                item.critical_risk_count ||
                0
              ),
              findings: Number(
                item.findings_count ||
                0
              ),
            })
          ),
      [currentAssessments]
    );

  const ruleData =
    useMemo(() => {
      if (
        clientFilter === "All"
      ) {
        return [];
      }

      const counts = {};

      selectedFindings.forEach(
        (finding) => {
          (
            finding.triggered_rules ||
            []
          ).forEach(
            (rule) => {
              const name =
                String(
                  rule || ""
                ).trim();

              if (name) {
                counts[name] =
                  (
                    counts[name] ||
                    0
                  ) + 1;
              }
            }
          );
        }
      );

      return Object.entries(
        counts
      )
        .map(
          ([
            rule,
            count,
          ]) => ({
            rule,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );
    }, [
      clientFilter,
      selectedFindings,
    ]);

  if (loading) {
    return (
      <div className="dashboard-state-card">
        Loading dashboard...
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="dashboard-state-card">
        No dashboard data
        available.
      </div>
    );
  }

  return (
    <div className="audit-dashboard-page">
      <section className="audit-dashboard-header">
        <div>
          <p className="audit-dashboard-eyebrow">
            {clientFilter ===
            "All"
              ? "Portfolio View"
              : "Client View"}
          </p>

          <h1 className="page-title">
            Audit Risk Dashboard
          </h1>

          <p className="page-subtitle">
            {clientFilter ===
            "All"
              ? (
                  "Current audit position using the latest completed assessment for each dataset. Reassessments do not double-count the portfolio."
                )
              : (
                  `Current audit position for ${
                    selectedClient
                      ?.client_name ||
                    "selected client"
                  }.`
                )}
          </p>
        </div>

        <div className="audit-dashboard-filters">
          <select
            value={clientFilter}
            onChange={(
              event
            ) => {
              setClientFilter(
                event.target.value
              );
              setDatasetFilter(
                "All"
              );
            }}
          >
            <option value="All">
              Overall Dashboard
            </option>

            {(
              summary.clients ||
              []
            ).map(
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
            onChange={(
              event
            ) =>
              setDatasetFilter(
                event.target.value
              )
            }
            disabled={
              clientFilter === "All"
            }
          >
            <option value="All">
              All Client Datasets
            </option>

            {availableDatasets.map(
              (dataset) => (
                <option
                  key={dataset.id}
                  value={dataset.id}
                >
                  {
                    dataset.dataset_name
                  }
                </option>
              )
            )}
          </select>

          <button
            className="secondary-btn"
            onClick={
              loadDashboard
            }
          >
            Refresh
          </button>
        </div>
      </section>

      <KpiRow
        portfolio={
          summary.portfolio
        }
        client={
          clientRows[0]
        }
        isPortfolio={
          clientFilter === "All"
        }
      />

      {clientFilter ===
      "All" ? (
        <PortfolioDashboard
          workload={
            clientWorkloadData
          }
          findings={
            selectedFindings.filter(
              (item) =>
                [
                  "High",
                  "Critical",
                ].includes(
                  item.risk_level
                )
            )
          }
          assessments={
            currentAssessments
          }
          navigate={navigate}
        />
      ) : (
        <ClientDashboard
          riskData={riskData}
          assessments={
            assessmentChartData
          }
          rules={ruleData}
          findings={
            selectedFindings.filter(
              (item) =>
                [
                  "High",
                  "Critical",
                ].includes(
                  item.risk_level
                )
            )
          }
          recentAssessments={
            currentAssessments
          }
          navigate={navigate}
        />
      )}
    </div>
  );
}


function KpiRow({
  portfolio,
  client,
  isPortfolio,
}) {
  const items =
    isPortfolio
      ? [
          [
            "Clients in scope",
            portfolio?.total_clients,
          ],
          [
            "Transactions reviewed",
            portfolio
              ?.total_transactions_reviewed,
          ],
          [
            "Findings",
            portfolio
              ?.total_findings,
          ],
          [
            "Require review",
            portfolio
              ?.review_required,
          ],
          [
            "Critical findings",
            portfolio
              ?.critical_findings,
          ],
          [
            "Current assessments",
            portfolio
              ?.current_assessments,
          ],
        ]
      : [
          [
            "Transactions reviewed",
            client
              ?.transactions_reviewed,
          ],
          [
            "Findings",
            client?.findings,
          ],
          [
            "Require review",
            client
              ?.review_required,
          ],
          [
            "Critical findings",
            client
              ?.critical_findings,
          ],
          [
            "Datasets",
            client?.datasets,
          ],
          [
            "Current assessments",
            client
              ?.current_assessments,
          ],
        ];

  return (
    <section className="audit-kpi-grid">
      {items.map(
        ([
          label,
          value,
        ]) => (
          <div
            className="audit-kpi-card"
            key={label}
          >
            <span>
              {label}
            </span>

            <strong>
              {formatNumber(
                value
              )}
            </strong>
          </div>
        )
      )}
    </section>
  );
}


function PortfolioDashboard({
  workload,
  findings,
  assessments,
  navigate,
}) {
  return (
    <section className="audit-widget-grid">
      <ChartCard
        title="Transactions Reviewed (Client-wise)"
        subtitle="Latest assessment of each dataset only; repeated executions are not added again."
      >
        {workload.some(
          (item) =>
            item.reviewed > 0
        ) ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={workload}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="client"
                tick={{
                  fontSize: 10,
                }}
              />
              <YAxis />
              <Tooltip
                formatter={(
                  value
                ) =>
                  formatNumber(
                    value
                  )
                }
              />
              <Bar
                dataKey="reviewed"
                name="Transactions reviewed"
                fill="#6D5BD0"
                radius={[
                  7,
                  7,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            message="No current assessments are available."
          />
        )}
      </ChartCard>

      <ChartCard
        title="Review Workload (Client-wise)"
        subtitle="Transactions requiring auditor attention, kept separate for every client."
      >
        {workload.some(
          (item) =>
            item.reviewRequired >
            0
        ) ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={workload}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="client"
                tick={{
                  fontSize: 10,
                }}
              />
              <YAxis
                allowDecimals={
                  false
                }
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="reviewRequired"
                name="Require review"
                fill="#D99054"
                radius={[
                  6,
                  6,
                  0,
                  0,
                ]}
              />
              <Bar
                dataKey="critical"
                name="Critical"
                fill="#A84692"
                radius={[
                  6,
                  6,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            message="No transactions currently require review."
          />
        )}
      </ChartCard>

      <ChartCard
        title="Finding Composition (Client-wise)"
        subtitle="Low, medium, high and critical findings from each client's current assessments."
      >
        {workload.some(
          (item) =>
            item.findings > 0
        ) ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={workload}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="client"
                tick={{
                  fontSize: 10,
                }}
              />
              <YAxis
                allowDecimals={
                  false
                }
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="low"
                name="Low"
                fill={
                  RISK_COLORS.Low
                }
                stackId="risk"
              />
              <Bar
                dataKey="medium"
                name="Medium"
                fill={
                  RISK_COLORS.Medium
                }
                stackId="risk"
              />
              <Bar
                dataKey="high"
                name="High"
                fill={
                  RISK_COLORS.High
                }
                stackId="risk"
              />
              <Bar
                dataKey="critical"
                name="Critical"
                fill={
                  RISK_COLORS.Critical
                }
                stackId="risk"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            message="No findings are available in the current assessment scope."
          />
        )}
      </ChartCard>

      <ChartCard
        title="Audit Attention Rate (Client-wise)"
        subtitle="Percentage of reviewed transactions currently requiring auditor attention. This is workload, not a client risk rating."
      >
        {workload.some(
          (item) =>
            item.reviewed > 0
        ) ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={workload}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="client"
                tick={{
                  fontSize: 10,
                }}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(
                  value
                ) =>
                  `${value}%`
                }
              />
              <Tooltip
                formatter={(
                  value
                ) => [
                  `${Number(
                    value || 0
                  ).toFixed(2)}%`,
                  "Require review",
                ]}
              />
              <Bar
                dataKey="reviewRate"
                name="Attention rate"
                fill="#5597A0"
                radius={[
                  7,
                  7,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            message="No reviewed transaction population is available."
          />
        )}
      </ChartCard>

      <TableCard
        title="Priority Findings"
      >
        <FindingsTable
          rows={findings}
          navigate={navigate}
        />
      </TableCard>

      <TableCard
        title="Current Dataset Assessments"
      >
        <AssessmentsTable
          rows={assessments}
          navigate={navigate}
        />
      </TableCard>
    </section>
  );
}


function ClientDashboard({
  riskData,
  assessments,
  rules,
  findings,
  recentAssessments,
  navigate,
}) {
  return (
    <section className="audit-widget-grid">
      <ChartCard
        title="Risk Distribution"
        subtitle="Current finding severity for the selected client and dataset scope."
      >
        {riskData.some(
          (item) =>
            item.value > 0
        ) ? (
          <DonutChart
            data={riskData}
          />
        ) : (
          <EmptyState
            message="No findings are stored for the current assessment in this scope."
          />
        )}
      </ChartCard>

      <ChartCard
        title="Audit Results by Dataset"
        subtitle="Current low, medium, high and critical findings for each selected dataset."
      >
        {assessments.some(
          (item) =>
            item.findings > 0
        ) ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={assessments}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 10,
                }}
              />
              <YAxis
                allowDecimals={
                  false
                }
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="low"
                name="Low"
                stackId="risk"
                fill={
                  RISK_COLORS.Low
                }
              />
              <Bar
                dataKey="medium"
                name="Medium"
                stackId="risk"
                fill={
                  RISK_COLORS.Medium
                }
              />
              <Bar
                dataKey="high"
                name="High"
                stackId="risk"
                fill={
                  RISK_COLORS.High
                }
              />
              <Bar
                dataKey="critical"
                name="Critical"
                stackId="risk"
                fill={
                  RISK_COLORS.Critical
                }
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            message="No finding distribution is available for the current assessment."
          />
        )}
      </ChartCard>

      <ChartCard
        title="Transactions Reviewed by Dataset"
        subtitle="Transaction population covered by the current assessment of each dataset."
      >
        {assessments.some(
          (item) =>
            item.reviewed > 0
        ) ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={assessments}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 10,
                }}
              />
              <YAxis
                allowDecimals={
                  false
                }
              />
              <Tooltip
                formatter={(
                  value
                ) =>
                  formatNumber(
                    value
                  )
                }
              />
              <Bar
                dataKey="reviewed"
                name="Transactions reviewed"
                fill="#6D5BD0"
                radius={[
                  7,
                  7,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            message="No current assessment is available for this scope."
          />
        )}
      </ChartCard>

      <ChartCard
        title="Triggered Audit Checks"
        subtitle="All configured audit checks triggered in the current client scope."
      >
        {rules.length ? (
          <div
            className="audit-scroll-chart"
            style={{
              height: Math.max(
                220,
                rules.length * 34
              ),
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={rules}
                layout="vertical"
                margin={{
                  left: 16,
                  right: 16,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  allowDecimals={
                    false
                  }
                />
                <YAxis
                  type="category"
                  dataKey="rule"
                  width={150}
                  tick={{
                    fontSize: 10,
                  }}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Triggered findings"
                  fill="#2563EB"
                  radius={[
                    0,
                    7,
                    7,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            message="No configured audit checks were triggered in the current scope."
          />
        )}
      </ChartCard>

      <TableCard
        title="Priority Findings"
      >
        <FindingsTable
          rows={findings}
          navigate={navigate}
        />
      </TableCard>

      <TableCard
        title="Current Dataset Assessments"
      >
        <AssessmentsTable
          rows={recentAssessments}
          navigate={navigate}
        />
      </TableCard>
    </section>
  );
}


function ChartCard({
  title,
  subtitle,
  children,
}) {
  return (
    <article className="audit-widget-card">
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>

      <div className="audit-chart-area">
        {children}
      </div>
    </article>
  );
}


function TableCard({
  title,
  children,
}) {
  return (
    <article className="audit-widget-card audit-table-widget">
      <header>
        <h2>{title}</h2>
      </header>

      {children}
    </article>
  );
}


function DonutChart({
  data,
}) {
  const total =
    data.reduce(
      (
        sum,
        item
      ) =>
        sum + item.value,
      0
    );

  return (
    <div className="audit-donut-wrap">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={83}
            paddingAngle={2}
          >
            {data.map(
              (item) => (
                <Cell
                  key={item.name}
                  fill={
                    RISK_COLORS[
                      item.name
                    ]
                  }
                />
              )
            )}
          </Pie>

          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <div className="audit-donut-center">
        <strong>
          {formatNumber(total)}
        </strong>

        <span>
          Findings
        </span>
      </div>
    </div>
  );
}


function FindingsTable({
  rows,
  navigate,
}) {
  if (!rows.length) {
    return (
      <EmptyState
        message="No High or Critical findings in the current scope."
      />
    );
  }

  return (
    <div className="table-wrap audit-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>
              Transaction
            </th>
            <th>Client</th>
            <th>Risk</th>
            <th>Score</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows
            .slice(0, 6)
            .map(
              (row) => (
                <tr
                  key={
                    row.finding_id
                  }
                >
                  <td>
                    {row.transaction_id ||
                      "-"}
                  </td>

                  <td>
                    {row.client_name ||
                      "-"}
                  </td>

                  <td>
                    <span
                      className={getRiskBadgeClass(
                        row.risk_level
                      )}
                    >
                      {
                        row.risk_level
                      }
                    </span>
                  </td>

                  <td>
                    <strong>
                      {Number(
                        row.risk_score ||
                        0
                      ).toFixed(1)}
                    </strong>
                  </td>

                  <td>
                    <button
                      className="secondary-btn"
                      onClick={() =>
                        navigate(
                          `/investigation?clientId=${row.client_id}` +
                            `&datasetId=${row.dataset_id}` +
                            `&analysisId=${row.analysis_id}`
                        )
                      }
                    >
                      Review
                    </button>
                  </td>
                </tr>
              )
            )}
        </tbody>
      </table>
    </div>
  );
}


function AssessmentsTable({
  rows,
  navigate,
}) {
  if (!rows.length) {
    return (
      <EmptyState
        message="No completed dataset assessments are available in this scope."
      />
    );
  }

  return (
    <div className="table-wrap audit-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Client</th>
            <th>Reviewed</th>
            <th>Findings</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows
            .slice(0, 6)
            .map(
              (row) => (
                <tr
                  key={row.id}
                >
                  <td>
                    {row.dataset_name ||
                      "-"}
                  </td>

                  <td>
                    {row.client_name ||
                      "-"}
                  </td>

                  <td>
                    {formatNumber(
                      row.total_transactions
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      row.findings_count
                    )}
                  </td>

                  <td>
                    <button
                      className="secondary-btn"
                      onClick={() =>
                        navigate(
                          `/investigation?clientId=${row.client_id}` +
                            `&datasetId=${row.dataset_id}` +
                            `&analysisId=${row.id}`
                        )
                      }
                    >
                      Open
                    </button>
                  </td>
                </tr>
              )
            )}
        </tbody>
      </table>
    </div>
  );
}


function EmptyState({
  message,
}) {
  return (
    <div className="dashboard-empty-state">
      {message}
    </div>
  );
}


function shortName(
  value
) {
  const text =
    String(
      value || "Dataset"
    );

  return (
    text.length > 15
      ? `${text.slice(
          0,
          13
        )}…`
      : text
  );
}


function formatNumber(
  value
) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-IN"
  );
}


function getRiskBadgeClass(
  level
) {
  if (
    level === "Critical"
  ) {
    return "badge badge-critical";
  }

  if (
    level === "High"
  ) {
    return "badge badge-high";
  }

  if (
    level === "Medium"
  ) {
    return "badge badge-medium";
  }

  return "badge badge-low";
}
