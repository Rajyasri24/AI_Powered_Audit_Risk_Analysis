import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import ForceGraph2D from "react-force-graph-2d";

import {
  analyseNetwork,
  getNetworkDatasets,
} from "../services/networkService";


export default function NetworkPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const graphContainerRef = useRef(null);
  const graphRef = useRef(null);

  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] =
    useState("");

  const [networkResult, setNetworkResult] =
    useState(null);

  const [pageLoading, setPageLoading] =
    useState(false);

  const [analysisLoading, setAnalysisLoading] =
    useState(false);

  const [selectedCluster, setSelectedCluster] =
    useState(null);

  const [selectedNode, setSelectedNode] =
    useState(null);

  const [identifierFilter, setIdentifierFilter] =
    useState("All");

  const [vendorSearch, setVendorSearch] =
    useState("");

  const [graphWidth, setGraphWidth] =
    useState(800);

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    const datasetIdFromUrl =
      searchParams.get("datasetId");

    if (datasetIdFromUrl) {
      setSelectedDataset(datasetIdFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    const container = graphContainerRef.current;

    if (!container) return undefined;

    const updateWidth = () => {
      const width = container.clientWidth;

      setGraphWidth(
        Math.max(300, width - 4)
      );
    };

    updateWidth();

    const observer = new ResizeObserver(
      updateWidth
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [networkResult]);

  const loadDatasets = async () => {
    try {
      setPageLoading(true);

      const data =
        await getNetworkDatasets();

      setDatasets(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Failed to load datasets for network analysis."
      );
    } finally {
      setPageLoading(false);
    }
  };

  const selectedDatasetDetails =
    useMemo(() => {
      return datasets.find(
        (dataset) =>
          String(dataset.id) ===
          String(selectedDataset)
      );
    }, [datasets, selectedDataset]);

  const identifierTypes = useMemo(() => {
    const identifiers =
      networkResult?.suspicious_identifiers ||
      [];

    return Array.from(
      new Set(
        identifiers
          .map(
            (item) =>
              item.identifier_type
          )
          .filter(Boolean)
      )
    );
  }, [networkResult]);

  const filteredIdentifiers =
    useMemo(() => {
      const identifiers =
        networkResult
          ?.suspicious_identifiers || [];

      if (identifierFilter === "All") {
        return identifiers;
      }

      return identifiers.filter(
        (item) =>
          item.identifier_type ===
          identifierFilter
      );
    }, [
      networkResult,
      identifierFilter,
    ]);

  const filteredVendors = useMemo(() => {
    const vendors =
      networkResult
        ?.top_connected_vendors || [];

    const searchValue = vendorSearch
      .trim()
      .toLowerCase();

    if (!searchValue) {
      return vendors;
    }

    return vendors.filter((vendor) => {
      const text = [
        vendor.vendor_id,
        vendor.vendor_name,
        vendor.network_score,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(searchValue);
    });
  }, [networkResult, vendorSearch]);

  const graphData = useMemo(() => {
    const nodes =
      networkResult?.graph?.nodes || [];

    const edges =
      networkResult?.graph?.edges || [];

    return {
      nodes: nodes.map((node) => ({
        ...node,
        name: node.label || node.id,
        val:
          node.node_type === "vendor"
            ? Math.max(
                7,
                Number(node.degree || 0) + 6
              )
            : Math.max(
                4,
                Number(node.degree || 0) + 3
              ),
      })),

      links: edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        relationship:
          edge.relationship || "related",
      })),
    };
  }, [networkResult]);

  const connectedNodeIds = useMemo(() => {
    if (!selectedNode?.id) {
      return new Set();
    }

    const ids = new Set([
      selectedNode.id,
    ]);

    graphData.links.forEach((link) => {
      const sourceId =
        typeof link.source === "object"
          ? link.source.id
          : link.source;

      const targetId =
        typeof link.target === "object"
          ? link.target.id
          : link.target;

      if (sourceId === selectedNode.id) {
        ids.add(targetId);
      }

      if (targetId === selectedNode.id) {
        ids.add(sourceId);
      }
    });

    return ids;
  }, [selectedNode, graphData]);

  const handleAnalyseNetwork = async () => {
    if (!selectedDataset) {
      alert("Please select a dataset.");
      return;
    }

    try {
      setAnalysisLoading(true);
      setNetworkResult(null);
      setSelectedCluster(null);
      setSelectedNode(null);

      const result =
        await analyseNetwork(
          selectedDataset
        );

      setNetworkResult(result);
    } catch (error) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Network analysis failed."
      );
    } finally {
      setAnalysisLoading(false);
    }
  };

  const goToAnalysis = () => {
    if (!selectedDatasetDetails) {
      navigate("/analysis");
      return;
    }

    navigate(
      `/analysis?clientId=${
        selectedDatasetDetails.client_id ||
        ""
      }&datasetId=${
        selectedDatasetDetails.id
      }`
    );
  };

  const goToFindings = () => {
    if (!selectedDatasetDetails) {
      navigate("/investigation");
      return;
    }

    navigate(
      `/investigation?clientId=${
        selectedDatasetDetails.client_id ||
        ""
      }&datasetId=${
        selectedDatasetDetails.id
      }`
    );
  };

  const resetGraphView = () => {
    setSelectedNode(null);

    if (graphRef.current) {
      graphRef.current.zoomToFit(
        500,
        70
      );
    }
  };

  const focusNode = (node) => {
    setSelectedNode(node);

    if (
      graphRef.current &&
      Number.isFinite(node.x) &&
      Number.isFinite(node.y)
    ) {
      graphRef.current.centerAt(
        node.x,
        node.y,
        700
      );

      graphRef.current.zoom(
        4,
        700
      );
    }
  };

  const renderNode = (
    node,
    context,
    globalScale
  ) => {
    const isVendor =
      node.node_type === "vendor";

    const isSelected =
      selectedNode?.id === node.id;

    const isConnected =
      connectedNodeIds.size === 0 ||
      connectedNodeIds.has(node.id);

    const radius =
      isSelected
        ? isVendor
          ? 11
          : 8
        : isVendor
        ? 8
        : 5;

    context.save();

    context.globalAlpha =
      isConnected ? 1 : 0.2;

    context.beginPath();

    context.arc(
      node.x,
      node.y,
      radius,
      0,
      2 * Math.PI
    );

    if (isSelected) {
      context.fillStyle = "#DC2626";
    } else if (isVendor) {
      context.fillStyle = "#7C3AED";
    } else {
      context.fillStyle =
        getIdentifierNodeColor(
          node.identifier_type
        );
    }

    context.fill();

    context.lineWidth =
      isSelected ? 3 : 1;

    context.strokeStyle =
      isSelected
        ? "#7F1D1D"
        : "#FFFFFF";

    context.stroke();

    const fontSize =
      Math.max(10 / globalScale, 2.5);

    context.font = `${fontSize}px Sans-Serif`;

    context.fillStyle = "#111827";

    context.textAlign = "left";
    context.textBaseline = "middle";

    const label =
      node.node_type === "vendor"
        ? node.name
        : formatIdentifierType(
            node.identifier_type
          );

    context.fillText(
      label,
      node.x + radius + 2,
      node.y
    );

    context.restore();
  };

  return (
    <div>
      <h1 className="page-title">
        Network Analytics
      </h1>

      <p className="page-subtitle">
        Detect vendors and entities connected
        through shared GST, PAN, bank account,
        phone, email, or address information.
      </p>

      <div className="nav-actions">
        <button
          className="secondary-btn"
          onClick={() =>
            navigate("/datasets")
          }
        >
          ← View Datasets
        </button>

        <button
          className="secondary-btn"
          onClick={goToAnalysis}
        >
          Run Full Analysis
        </button>

        <button
          className="primary-btn"
          onClick={goToFindings}
        >
          View Findings →
        </button>
      </div>

      <div
        className="card"
        style={{ marginTop: "24px" }}
      >
        <h2 style={{ marginTop: 0 }}>
          Select Dataset
        </h2>

        {pageLoading && (
          <p>Loading datasets...</p>
        )}

        <div style={selectionRowStyle}>
          <select
            value={selectedDataset}
            onChange={(event) => {
              setSelectedDataset(
                event.target.value
              );

              setNetworkResult(null);
              setSelectedCluster(null);
              setSelectedNode(null);
            }}
          >
            <option value="">
              -- Select Dataset --
            </option>

            {datasets.map((dataset) => (
              <option
                key={dataset.id}
                value={dataset.id}
              >
                {dataset.dataset_name}
                {" — "}
                {dataset.clients
                  ?.client_name ||
                  "Unknown Client"}
              </option>
            ))}
          </select>

          <button
            className="primary-btn"
            onClick={handleAnalyseNetwork}
            disabled={
              analysisLoading ||
              !selectedDataset
            }
          >
            {analysisLoading
              ? "Analysing Network..."
              : "Run Network Analysis"}
          </button>
        </div>

        {selectedDatasetDetails && (
          <div className="preview-box">
            <strong>
              Selected Dataset
            </strong>

            <p style={{ marginBottom: 0 }}>
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
              {
                selectedDatasetDetails
                  .total_columns
              }{" "}
              columns
              {" • "}
              {selectedDatasetDetails
                .clients?.client_name ||
                "Unknown Client"}
            </p>
          </div>
        )}
      </div>

      {networkResult && (
        <>
          {!networkResult.supported && (
            <div style={warningBoxStyle}>
              <strong>
                Network analysis could not
                identify relationship columns.
              </strong>

              <p style={{ marginBottom: 0 }}>
                The dataset should contain at
                least one supported field such as
                GST, PAN, bank account, phone,
                email, or address.
              </p>
            </div>
          )}

          <div style={statsGridStyle}>
            <StatCard
              title="Total Nodes"
              value={
                networkResult.summary
                  ?.total_nodes
              }
            />

            <StatCard
              title="Relationships"
              value={
                networkResult.summary
                  ?.total_edges
              }
            />

            <StatCard
              title="Vendor Nodes"
              value={
                networkResult.summary
                  ?.vendor_nodes
              }
            />

            <StatCard
              title="Connected Components"
              value={
                networkResult.summary
                  ?.connected_components
              }
            />

            <StatCard
              title="Suspicious Clusters"
              value={
                networkResult.summary
                  ?.suspicious_clusters
              }
            />

            <StatCard
              title="Network Findings"
              value={
                networkResult.summary
                  ?.network_findings
              }
            />
          </div>

          <div
            className="card"
            style={{ marginTop: "24px" }}
          >
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={{ margin: 0 }}>
                  Interactive Relationship
                  Graph
                </h2>

                <p style={sectionSubtitleStyle}>
                  Drag nodes, zoom, pan, and click
                  an entity to highlight its direct
                  relationships.
                </p>
              </div>

              <button
                className="secondary-btn"
                onClick={resetGraphView}
              >
                Reset Graph View
              </button>
            </div>

            <div style={legendStyle}>
              <LegendItem
                color="#7C3AED"
                label="Vendor"
              />

              <LegendItem
                color="#2563EB"
                label="GST"
              />

              <LegendItem
                color="#059669"
                label="PAN"
              />

              <LegendItem
                color="#DC2626"
                label="Bank Account"
              />

              <LegendItem
                color="#D97706"
                label="Phone"
              />

              <LegendItem
                color="#DB2777"
                label="Email"
              />

              <LegendItem
                color="#6B7280"
                label="Address"
              />
            </div>

            {graphData.nodes.length === 0 ? (
              <div style={emptyGraphStyle}>
                <h3>
                  No relationship graph
                  available
                </h3>

                <p style={{ marginBottom: 0 }}>
                  This dataset does not contain
                  shared network identifiers.
                </p>
              </div>
            ) : (
              <div
                ref={graphContainerRef}
                style={graphContainerStyle}
              >
                <ForceGraph2D
                  ref={graphRef}
                  graphData={graphData}
                  width={graphWidth}
                  height={620}
                  backgroundColor="#FFFFFF"
                  cooldownTicks={120}
                  warmupTicks={20}
                  d3AlphaDecay={0.025}
                  d3VelocityDecay={0.35}
                  enableNodeDrag
                  enableZoomInteraction
                  enablePanInteraction
                  nodeRelSize={5}
                  nodeVal={(node) =>
                    node.val || 5
                  }
                  nodeCanvasObject={renderNode}
                  nodePointerAreaPaint={(
                    node,
                    color,
                    context
                  ) => {
                    context.fillStyle = color;

                    context.beginPath();

                    context.arc(
                      node.x,
                      node.y,
                      node.node_type ===
                        "vendor"
                        ? 11
                        : 8,
                      0,
                      2 * Math.PI
                    );

                    context.fill();
                  }}
                  nodeLabel={(node) =>
                    buildNodeTooltip(node)
                  }
                  onNodeClick={focusNode}
                  linkLabel={(link) =>
                    formatIdentifierType(
                      link.relationship
                    )
                  }
                  linkColor={(link) => {
                    if (!selectedNode) {
                      return "#CBD5E1";
                    }

                    const sourceId =
                      typeof link.source ===
                      "object"
                        ? link.source.id
                        : link.source;

                    const targetId =
                      typeof link.target ===
                      "object"
                        ? link.target.id
                        : link.target;

                    const connected =
                      sourceId ===
                        selectedNode.id ||
                      targetId ===
                        selectedNode.id;

                    return connected
                      ? "#7C3AED"
                      : "#E5E7EB";
                  }}
                  linkWidth={(link) => {
                    if (
                      link.relationship ===
                      "bank_account"
                    ) {
                      return 2.8;
                    }

                    if (
                      link.relationship ===
                        "gst" ||
                      link.relationship ===
                        "pan"
                    ) {
                      return 2;
                    }

                    return 1.2;
                  }}
                  linkDirectionalParticles={(
                    link
                  ) => {
                    if (!selectedNode) {
                      return 0;
                    }

                    const sourceId =
                      typeof link.source ===
                      "object"
                        ? link.source.id
                        : link.source;

                    const targetId =
                      typeof link.target ===
                      "object"
                        ? link.target.id
                        : link.target;

                    return sourceId ===
                      selectedNode.id ||
                      targetId ===
                        selectedNode.id
                      ? 3
                      : 0;
                  }}
                  linkDirectionalParticleWidth={
                    2
                  }
                  linkDirectionalParticleSpeed={
                    0.006
                  }
                  onEngineStop={() => {
                    if (
                      graphRef.current &&
                      !selectedNode
                    ) {
                      graphRef.current.zoomToFit(
                        500,
                        70
                      );
                    }
                  }}
                />
              </div>
            )}

            {selectedNode && (
              <div style={selectedNodeStyle}>
                <div>
                  <p style={smallLabelStyle}>
                    Selected Node
                  </p>

                  <h3
                    style={{
                      margin: "4px 0",
                    }}
                  >
                    {selectedNode.name ||
                      selectedNode.label ||
                      selectedNode.id}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "#6B7280",
                    }}
                  >
                    Type:{" "}
                    {selectedNode.node_type ===
                    "vendor"
                      ? "Vendor"
                      : formatIdentifierType(
                          selectedNode
                            .identifier_type
                        )}
                    {" • "}
                    Degree:{" "}
                    {selectedNode.degree ?? 0}
                  </p>
                </div>

                <button
                  className="secondary-btn"
                  onClick={() =>
                    setSelectedNode(null)
                  }
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>

          <div style={twoColumnStyle}>
            <div className="card">
              <h2 style={{ marginTop: 0 }}>
                Detected Columns
              </h2>

              <InfoRow
                label="Vendor ID"
                value={
                  networkResult
                    .columns_detected
                    ?.vendor_id_column ||
                  "Not detected"
                }
              />

              <InfoRow
                label="Vendor Name"
                value={
                  networkResult
                    .columns_detected
                    ?.vendor_name_column ||
                  "Not detected"
                }
              />

              <InfoRow
                label="Transaction ID"
                value={
                  networkResult
                    .columns_detected
                    ?.transaction_id_column ||
                  "Row index"
                }
              />

              <div
                style={{
                  marginTop: "14px",
                }}
              >
                <strong>
                  Relationship Columns
                </strong>

                {Object.keys(
                  networkResult
                    .columns_detected
                    ?.identifier_columns || {}
                ).length === 0 ? (
                  <p
                    style={{
                      color: "#6B7280",
                    }}
                  >
                    No relationship columns
                    detected.
                  </p>
                ) : (
                  <ul>
                    {Object.entries(
                      networkResult
                        .columns_detected
                        ?.identifier_columns ||
                        {}
                    ).map(
                      ([
                        identifierType,
                        sourceColumn,
                      ]) => (
                        <li
                          key={
                            identifierType
                          }
                        >
                          <strong>
                            {formatIdentifierType(
                              identifierType
                            )}
                          </strong>
                          : {sourceColumn}
                        </li>
                      )
                    )}
                  </ul>
                )}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>
                Graph Summary
              </h2>

              <InfoRow
                label="Identifier Nodes"
                value={
                  networkResult.summary
                    ?.identifier_nodes
                }
              />

              <InfoRow
                label="Suspicious Identifiers"
                value={
                  networkResult.summary
                    ?.suspicious_identifiers
                }
              />

              <InfoRow
                label="Graph Density"
                value={
                  networkResult.summary
                    ?.graph_density
                }
              />

              <InfoRow
                label="Largest Cluster"
                value={getLargestClusterSize(
                  networkResult
                    .suspicious_clusters
                )}
              />
            </div>
          </div>

          <div
            className="card"
            style={{ marginTop: "24px" }}
          >
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={{ margin: 0 }}>
                  Suspicious Clusters
                </h2>

                <p style={sectionSubtitleStyle}>
                  Connected vendor groups sharing
                  one or more sensitive
                  identifiers.
                </p>
              </div>
            </div>

            {networkResult
              .suspicious_clusters?.length ===
            0 ? (
              <p
                style={{
                  color: "#6B7280",
                }}
              >
                No suspicious multi-vendor
                clusters were detected.
              </p>
            ) : (
              <div style={clusterGridStyle}>
                {networkResult
                  .suspicious_clusters?.map(
                    (cluster) => (
                      <button
                        type="button"
                        key={
                          cluster.cluster_id
                        }
                        onClick={() =>
                          setSelectedCluster(
                            cluster
                          )
                        }
                        style={{
                          ...clusterCardStyle,
                          ...(selectedCluster
                            ?.cluster_id ===
                          cluster.cluster_id
                            ? selectedClusterStyle
                            : {}),
                        }}
                      >
                        <div
                          style={
                            clusterTopStyle
                          }
                        >
                          <strong>
                            {
                              cluster.cluster_id
                            }
                          </strong>

                          <span
                            className={getClusterBadgeClass(
                              cluster.cluster_score
                            )}
                          >
                            Score{" "}
                            {
                              cluster.cluster_score
                            }
                          </span>
                        </div>

                        <p>
                          {cluster.vendor_count}{" "}
                          connected vendors
                        </p>

                        <p
                          style={{
                            marginBottom: 0,
                          }}
                        >
                          {
                            cluster
                              .shared_identifiers
                              ?.length
                          }{" "}
                          shared identifiers
                        </p>
                      </button>
                    )
                  )}
              </div>
            )}

            {selectedCluster && (
              <div style={clusterDetailStyle}>
                <h3 style={{ marginTop: 0 }}>
                  {
                    selectedCluster.cluster_id
                  }{" "}
                  Details
                </h3>

                <div style={twoColumnStyle}>
                  <div>
                    <h4>
                      Connected Vendors
                    </h4>

                    <ul>
                      {selectedCluster
                        .vendor_names?.map(
                          (
                            vendorName,
                            index
                          ) => (
                            <li key={index}>
                              {vendorName}
                            </li>
                          )
                        )}
                    </ul>
                  </div>

                  <div>
                    <h4>
                      Shared Identifiers
                    </h4>

                    <ul>
                      {selectedCluster
                        .shared_identifiers?.map(
                          (
                            identifier,
                            index
                          ) => (
                            <li key={index}>
                              <strong>
                                {formatIdentifierType(
                                  identifier
                                    .identifier_type
                                )}
                              </strong>
                              :{" "}
                              {
                                identifier
                                  .identifier_value
                              }{" "}
                              (
                              {
                                identifier
                                  .vendor_count
                              }{" "}
                              vendors)
                            </li>
                          )
                        )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className="card"
            style={{ marginTop: "24px" }}
          >
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={{ margin: 0 }}>
                  Shared Identifier Explorer
                </h2>

                <p style={sectionSubtitleStyle}>
                  Sensitive identifiers connected
                  to more than one vendor.
                </p>
              </div>

              <select
                value={identifierFilter}
                onChange={(event) =>
                  setIdentifierFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All Identifier Types
                </option>

                {identifierTypes.map(
                  (identifierType) => (
                    <option
                      key={identifierType}
                      value={identifierType}
                    >
                      {formatIdentifierType(
                        identifierType
                      )}
                    </option>
                  )
                )}
              </select>
            </div>

            {filteredIdentifiers.length ===
            0 ? (
              <p
                style={{
                  color: "#6B7280",
                }}
              >
                No shared identifiers match this
                filter.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        Identifier Type
                      </th>
                      <th>
                        Identifier Value
                      </th>
                      <th>
                        Connected Vendors
                      </th>
                      <th>Vendor IDs</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredIdentifiers.map(
                      (identifier) => (
                        <tr
                          key={
                            identifier
                              .identifier_key
                          }
                        >
                          <td>
                            {formatIdentifierType(
                              identifier
                                .identifier_type
                            )}
                          </td>

                          <td>
                            <strong>
                              {
                                identifier
                                  .identifier_value
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              identifier
                                .vendor_count
                            }
                          </td>

                          <td>
                            {identifier
                              .vendor_ids?.join(
                                ", "
                              )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div
            className="card"
            style={{ marginTop: "24px" }}
          >
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={{ margin: 0 }}>
                  Top Connected Vendors
                </h2>

                <p style={sectionSubtitleStyle}>
                  Vendors ranked by network risk,
                  relationships, and graph
                  connectivity.
                </p>
              </div>

              <input
                placeholder="Search vendor..."
                value={vendorSearch}
                onChange={(event) =>
                  setVendorSearch(
                    event.target.value
                  )
                }
              />
            </div>

            {filteredVendors.length === 0 ? (
              <p
                style={{
                  color: "#6B7280",
                }}
              >
                No connected vendors found.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Vendor ID</th>
                      <th>Graph Degree</th>
                      <th>
                        Shared Relationships
                      </th>
                      <th>Centrality</th>
                      <th>
                        Network Score
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredVendors.map(
                      (vendor) => (
                        <tr
                          key={
                            vendor.vendor_id
                          }
                        >
                          <td>
                            <strong>
                              {
                                vendor.vendor_name
                              }
                            </strong>
                          </td>

                          <td>
                            {vendor.vendor_id}
                          </td>

                          <td>
                            {vendor.degree}
                          </td>

                          <td>
                            {
                              vendor
                                .shared_relationships
                            }
                          </td>

                          <td>
                            {
                              vendor.centrality
                            }
                          </td>

                          <td>
                            <span
                              className={getNetworkBadgeClass(
                                vendor.network_score
                              )}
                            >
                              {
                                vendor.network_score
                              }
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div
            className="card"
            style={{ marginTop: "24px" }}
          >
            <h2 style={{ marginTop: 0 }}>
              Transaction Network Findings
            </h2>

            <p style={sectionSubtitleStyle}>
              Transactions associated with
              vendors that share suspicious
              identifiers.
            </p>

            {networkResult.network_findings
              ?.length === 0 ? (
              <p
                style={{
                  color: "#6B7280",
                }}
              >
                No transaction-level network
                findings were generated.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        Transaction ID
                      </th>
                      <th>Vendor</th>
                      <th>
                        Network Score
                      </th>
                      <th>Reasons</th>
                    </tr>
                  </thead>

                  <tbody>
                    {networkResult
                      .network_findings?.slice(
                        0,
                        100
                      )
                      .map(
                        (
                          finding,
                          index
                        ) => (
                          <tr
                            key={`${finding.transaction_id}-${index}`}
                          >
                            <td>
                              {
                                finding.transaction_id
                              }
                            </td>

                            <td>
                              {finding.vendor_name ||
                                finding.vendor_id}
                            </td>

                            <td>
                              <span
                                className={getNetworkBadgeClass(
                                  finding.network_score
                                )}
                              >
                                {
                                  finding.network_score
                                }
                              </span>
                            </td>

                            <td>
                              {Array.isArray(
                                finding.network_reasons
                              )
                                ? finding.network_reasons.join(
                                    " | "
                                  )
                                : "-"}
                            </td>
                          </tr>
                        )
                      )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


function StatCard({ title, value }) {
  return (
    <div className="card">
      <p
        style={{
          color: "#6B7280",
          margin: 0,
        }}
      >
        {title}
      </p>

      <h2
        style={{
          margin: "8px 0 0",
          fontSize: "30px",
        }}
      >
        {value ?? 0}
      </h2>
    </div>
  );
}


function InfoRow({ label, value }) {
  return (
    <div style={infoRowStyle}>
      <span
        style={{
          color: "#6B7280",
        }}
      >
        {label}
      </span>

      <strong>{value ?? "-"}</strong>
    </div>
  );
}


function LegendItem({ color, label }) {
  return (
    <div style={legendItemStyle}>
      <span
        style={{
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />

      <span>{label}</span>
    </div>
  );
}


function buildNodeTooltip(node) {
  const label =
    node.name ||
    node.label ||
    node.id;

  if (node.node_type === "vendor") {
    return `
      <div style="padding:6px">
        <strong>${escapeHtml(label)}</strong><br/>
        Type: Vendor<br/>
        Vendor ID: ${escapeHtml(
          node.vendor_id || "-"
        )}<br/>
        Degree: ${Number(
          node.degree || 0
        )}
      </div>
    `;
  }

  return `
    <div style="padding:6px">
      <strong>${escapeHtml(label)}</strong><br/>
      Type: ${escapeHtml(
        formatIdentifierType(
          node.identifier_type
        )
      )}<br/>
      Value: ${escapeHtml(
        node.identifier_value || "-"
      )}<br/>
      Degree: ${Number(
        node.degree || 0
      )}
    </div>
  `;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatIdentifierType(value) {
  if (!value) return "-";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}


function getLargestClusterSize(
  clusters
) {
  if (
    !Array.isArray(clusters) ||
    clusters.length === 0
  ) {
    return 0;
  }

  return Math.max(
    ...clusters.map(
      (cluster) =>
        Number(cluster.vendor_count) ||
        0
    )
  );
}


function getIdentifierNodeColor(type) {
  if (type === "gst") {
    return "#2563EB";
  }

  if (type === "pan") {
    return "#059669";
  }

  if (type === "bank_account") {
    return "#DC2626";
  }

  if (type === "phone") {
    return "#D97706";
  }

  if (type === "email") {
    return "#DB2777";
  }

  if (type === "address") {
    return "#6B7280";
  }

  return "#64748B";
}


function getNetworkBadgeClass(score) {
  const numericScore =
    Number(score || 0);

  if (numericScore >= 30) {
    return "badge badge-critical";
  }

  if (numericScore >= 20) {
    return "badge badge-high";
  }

  if (numericScore > 0) {
    return "badge badge-medium";
  }

  return "badge badge-low";
}


function getClusterBadgeClass(score) {
  const numericScore =
    Number(score || 0);

  if (numericScore >= 70) {
    return "badge badge-critical";
  }

  if (numericScore >= 45) {
    return "badge badge-high";
  }

  return "badge badge-medium";
}


const statsGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "16px",
  marginTop: "24px",
};


const selectionRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "12px",
  alignItems: "center",
};


const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "20px",
  marginTop: "24px",
};


const sectionHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
};


const sectionSubtitleStyle = {
  color: "#6B7280",
  margin: "6px 0 0",
};


const graphContainerStyle = {
  width: "100%",
  minHeight: "620px",
  overflow: "hidden",
  border: "1px solid #E5E7EB",
  borderRadius: "18px",
  marginTop: "18px",
  background: "#FFFFFF",
};


const emptyGraphStyle = {
  marginTop: "18px",
  minHeight: "240px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  background: "#F8F9FC",
  border: "1px dashed #CBD5E1",
  borderRadius: "18px",
  color: "#6B7280",
};


const legendStyle = {
  display: "flex",
  gap: "14px",
  flexWrap: "wrap",
  marginTop: "16px",
  padding: "12px",
  background: "#F8F9FC",
  borderRadius: "14px",
};


const legendItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  color: "#374151",
};


const selectedNodeStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  marginTop: "16px",
  padding: "16px",
  background: "#F5F3FF",
  border: "1px solid #C4B5FD",
  borderRadius: "16px",
};


const smallLabelStyle = {
  margin: 0,
  color: "#6B7280",
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};


const clusterGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
  marginTop: "18px",
};


const clusterCardStyle = {
  textAlign: "left",
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: "16px",
  padding: "16px",
  cursor: "pointer",
  color: "inherit",
};


const selectedClusterStyle = {
  border: "2px solid #7C3AED",
  background: "#F5F3FF",
};


const clusterTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
};


const clusterDetailStyle = {
  marginTop: "20px",
  borderTop: "1px solid #E5E7EB",
  paddingTop: "20px",
};


const infoRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "10px 0",
  borderBottom: "1px solid #F3F4F6",
};


const warningBoxStyle = {
  marginTop: "24px",
  background: "#FFF7ED",
  border: "1px solid #FDBA74",
  color: "#9A3412",
  borderRadius: "16px",
  padding: "16px",
};