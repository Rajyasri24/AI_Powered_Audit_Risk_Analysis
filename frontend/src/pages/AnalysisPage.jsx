import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  getDatasets,
} from "../services/datasetService";

import {
  getAnalyses,
  runAnalysis,
} from "../services/analysisService";


export default function AnalysisPage() {
  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const [datasets, setDatasets] =
    useState([]);

  const [
    currentAssessments,
    setCurrentAssessments,
  ] = useState([]);

  const [
    selectedDataset,
    setSelectedDataset,
  ] = useState("");

  const [
    assessmentResult,
    setAssessmentResult,
  ] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [
    pageLoading,
    setPageLoading,
  ] = useState(false);

  const clientIdFromUrl =
    searchParams.get(
      "clientId"
    ) || "";

  useEffect(() => {
    const datasetIdFromUrl =
      searchParams.get(
        "datasetId"
      );

    if (
      datasetIdFromUrl
    ) {
      setSelectedDataset(
        datasetIdFromUrl
      );
    }

    loadPageData();
  }, [searchParams]);

  const loadPageData =
    async () => {
      try {
        setPageLoading(true);

        const [
          datasetData,
          assessmentData,
        ] =
          await Promise.all([
            getDatasets(),
            getAnalyses(),
          ]);

        setDatasets(
          Array.isArray(
            datasetData
          )
            ? datasetData
            : []
        );

        setCurrentAssessments(
          Array.isArray(
            assessmentData
          )
            ? assessmentData
            : []
        );
      } catch (error) {
        console.error(error);

        alert(
          error?.response?.data
            ?.detail ||
            "Failed to load assessment data."
        );
      } finally {
        setPageLoading(
          false
        );
      }
    };

  const availableDatasets =
    useMemo(() => {
      if (
        !clientIdFromUrl
      ) {
        return datasets;
      }

      return datasets.filter(
        (dataset) =>
          String(
            dataset.client_id
          ) === String(
            clientIdFromUrl
          )
      );
    }, [
      datasets,
      clientIdFromUrl,
    ]);

  const selectedDatasetDetails =
    useMemo(() => {
      return datasets.find(
        (dataset) =>
          String(
            dataset.id
          ) === String(
            selectedDataset
          )
      );
    }, [
      datasets,
      selectedDataset,
    ]);

  const currentAssessment =
    useMemo(() => {
      return currentAssessments.find(
        (item) =>
          String(
            item.dataset_id
          ) === String(
            selectedDataset
          )
      );
    }, [
      currentAssessments,
      selectedDataset,
    ]);

  const goToFindings = (
    analysisId = ""
  ) => {
    const clientId =
      selectedDatasetDetails
        ?.client_id ||
      assessmentResult
        ?.client_id ||
      "";

    const datasetId =
      selectedDataset ||
      assessmentResult
        ?.dataset_id ||
      "";

    const currentAnalysisId =
      analysisId ||
      assessmentResult
        ?.analysis_id ||
      currentAssessment?.id ||
      "";

    if (
      clientId &&
      datasetId &&
      currentAnalysisId
    ) {
      navigate(
        `/investigation?clientId=${clientId}` +
          `&datasetId=${datasetId}` +
          `&analysisId=${currentAnalysisId}`
      );

      return;
    }

    if (
      clientId &&
      datasetId
    ) {
      navigate(
        `/investigation?clientId=${clientId}` +
          `&datasetId=${datasetId}`
      );

      return;
    }

    navigate(
      "/investigation"
    );
  };

  const handleAssessment =
    async () => {
      if (
        !selectedDataset
      ) {
        alert(
          "Please select a dataset."
        );

        return;
      }

      try {
        setLoading(true);
        setAssessmentResult(
          null
        );

        const result =
          await runAnalysis(
            selectedDataset
          );

        if (
          !result ||
          result.error
        ) {
          throw new Error(
            result?.error ||
              "Assessment did not return a valid result."
          );
        }

        if (
          !result.analysis_id
        ) {
          throw new Error(
            "Assessment record was not created."
          );
        }

        setAssessmentResult(
          result
        );

        await loadPageData();

        alert(
          `Assessment completed successfully.\n` +
            `Transactions reviewed: ${result.total_transactions ?? 0}\n` +
            `Findings requiring review: ${result.findings_count ?? 0}`
        );
      } catch (error) {
        console.error(
          "Assessment error:",
          error
        );

        alert(
          error?.response?.data
            ?.detail ||
            error?.message ||
            "Assessment failed."
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div>
      <h1 className="page-title">
        Dataset Assessment
      </h1>

      <p className="page-subtitle">
        Run the audit assessment on an uploaded transaction dataset. The latest completed result automatically becomes the current result used across the platform.
      </p>

      <div className="nav-actions">
        <button
          className="secondary-btn"
          onClick={() => {
            if (
              clientIdFromUrl
            ) {
              navigate(
                `/datasets?clientId=${clientIdFromUrl}`
              );

              return;
            }

            navigate(
              "/datasets"
            );
          }}
        >
          ← View Datasets
        </button>

        <button
          className="secondary-btn"
          onClick={() => {
            const clientId =
              selectedDatasetDetails
                ?.client_id ||
              clientIdFromUrl;

            navigate(
              clientId
                ? `/rules?clientId=${clientId}`
                : "/rules"
            );
          }}
        >
          Review Audit Checks
        </button>

        <button
          className="primary-btn"
          onClick={() =>
            goToFindings()
          }
          disabled={
            !selectedDataset
          }
        >
          View Current Findings →
        </button>
      </div>

      <div
        className="card"
        style={{
          marginTop: "24px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Select Dataset
        </h2>

        {pageLoading && (
          <p>
            Loading datasets...
          </p>
        )}

        <select
          value={
            selectedDataset
          }
          onChange={(
            event
          ) => {
            setSelectedDataset(
              event.target.value
            );
            setAssessmentResult(
              null
            );
          }}
        >
          <option value="">
            -- Select Dataset --
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
                {" — "}
                {dataset.clients
                  ?.client_name ||
                  "Unknown Client"}
              </option>
            )
          )}
        </select>

        {selectedDatasetDetails && (
          <div className="preview-box">
            <strong>
              Selected Dataset
            </strong>

            <p
              style={{
                marginBottom: 0,
              }}
            >
              {
                selectedDatasetDetails
                  .dataset_name
              }
              {" • "}
              {
                selectedDatasetDetails
                  .total_records
              }{" "}
              records
              {" • "}
              {selectedDatasetDetails
                .clients
                ?.client_name ||
                "Unknown Client"}
            </p>

            <p>
              <strong>
                Assessment status:
              </strong>{" "}
              {currentAssessment
                ? (
                    `Latest completed assessment: ${formatDate(
                      currentAssessment
                        .created_at
                    )}`
                  )
                : (
                    "Not yet assessed"
                  )}
            </p>
          </div>
        )}

        <button
          className="primary-btn"
          onClick={
            handleAssessment
          }
          disabled={
            loading ||
            !selectedDataset
          }
        >
          {loading
            ? "Assessing Dataset..."
            : currentAssessment
              ? "Run Analysis Again"
              : "Run Analysis"}
        </button>
      </div>

      {assessmentResult && (
        <div
          className="card"
          style={{
            marginTop: "24px",
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            Analysis Completed
          </h2>

          <div
            className="form-grid"
          >
            <InfoItem
              label="Transactions Reviewed"
              value={
                assessmentResult
                  .total_transactions
              }
            />

            <InfoItem
              label="Findings"
              value={
                assessmentResult
                  .findings_count
              }
            />

            <InfoItem
              label="Low"
              value={
                assessmentResult
                  .low_risk_count
              }
            />

            <InfoItem
              label="Medium"
              value={
                assessmentResult
                  .medium_risk_count
              }
            />

            <InfoItem
              label="High / Critical"
              value={
                assessmentResult
                  .high_risk_count
              }
            />
          </div>

          <div
            style={{
              marginTop: "18px",
              padding: "12px",
              borderRadius: "10px",
              background:
                "#f8fafc",
              color:
                "#475569",
            }}
          >
            This completed result is now the current assessment for this dataset and is automatically used by Dashboard, Findings, Reports, and the AI Copilot context.
          </div>

          <div className="nav-actions">
            <button
              className="primary-btn"
              onClick={() =>
                goToFindings(
                  assessmentResult
                    .analysis_id
                )
              }
            >
              Investigate Current
              Findings
            </button>

            <button
              className="secondary-btn"
              onClick={() =>
                navigate(
                  "/reports"
                )
              }
            >
              Generate Report
            </button>
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          marginTop: "24px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Current Dataset
          Assessments
        </h2>

        <p className="page-subtitle">
          The most recent completed result is shown for each dataset and is used across the platform.
        </p>

        {currentAssessments.length ===
        0 ? (
          <p>
            No completed
            assessments yet.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    Dataset
                  </th>
                  <th>
                    Client
                  </th>
                  <th>
                    Reviewed
                  </th>
                  <th>
                    Assessed On
                  </th>
                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {currentAssessments.map(
                  (item) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <td>
                        {item.datasets
                          ?.dataset_name ||
                          item.dataset_id}
                      </td>

                      <td>
                        {item.datasets
                          ?.clients
                          ?.client_name ||
                          "-"}
                      </td>

                      <td>
                        {Number(
                          item.total_transactions ||
                            0
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </td>

                      <td>
                        {formatDate(
                          item.created_at
                        )}
                      </td>

                      <td>
                        <button
                          className="secondary-btn"
                          onClick={() =>
                            navigate(
                              `/investigation?clientId=${item.client_id}` +
                                `&datasetId=${item.dataset_id}` +
                                `&analysisId=${item.id}`
                            )
                          }
                        >
                          Open Findings
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


function InfoItem({
  label,
  value,
}) {
  return (
    <div className="info-item">
      <span>
        {label}
      </span>

      <strong>
        {value ?? 0}
      </strong>
    </div>
  );
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
