import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ForceGraph2D from "react-force-graph-2d";

import { analyseNetwork } from "../services/networkService";


export default function NetworkGraphModal({
  open,
  onClose,
  datasetId,
  datasetName,
  clientName,
}) {
  const graphRef = useRef(null);
  const graphContainerRef = useRef(null);

  const [networkResult, setNetworkResult] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [graphWidth, setGraphWidth] =
    useState(900);

  const [selectedNode, setSelectedNode] =
    useState(null);

  const [relationshipFilter, setRelationshipFilter] =
    useState("All");

  const [showLabels, setShowLabels] =
    useState(true);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || !datasetId) {
      return;
    }

    loadNetwork();
  }, [open, datasetId]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const container =
      graphContainerRef.current;

    if (!container) {
      return undefined;
    }

    const updateWidth = () => {
      setGraphWidth(
        Math.max(
          320,
          container.clientWidth - 4
        )
      );
    };

    updateWidth();

    const observer =
      new ResizeObserver(updateWidth);

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [open, networkResult]);

  const loadNetwork = async () => {
    try {
      setLoading(true);
      setError("");
      setSelectedNode(null);

      const result =
        await analyseNetwork(datasetId);

      setNetworkResult(result);
    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError?.response?.data?.detail ||
          "Failed to load network intelligence."
      );
    } finally {
      setLoading(false);
    }
  };

  const relationshipTypes =
    useMemo(() => {
      const edges =
        networkResult?.graph?.edges || [];

      return Array.from(
        new Set(
          edges
            .map(
              (edge) =>
                edge.relationship
            )
            .filter(Boolean)
        )
      ).sort();
    }, [networkResult]);

  const graphData = useMemo(() => {
    const sourceNodes =
      networkResult?.graph?.nodes || [];

    const sourceEdges =
      networkResult?.graph?.edges || [];

    const filteredEdges =
      relationshipFilter === "All"
        ? sourceEdges
        : sourceEdges.filter(
            (edge) =>
              edge.relationship ===
              relationshipFilter
          );

    const visibleNodeIds = new Set();

    filteredEdges.forEach((edge) => {
      visibleNodeIds.add(edge.source);
      visibleNodeIds.add(edge.target);
    });

    const filteredNodes =
      relationshipFilter === "All"
        ? sourceNodes
        : sourceNodes.filter(
            (node) =>
              visibleNodeIds.has(node.id)
          );

    return {
      nodes: filteredNodes.map(
        (node) => ({
          ...node,
          name:
            node.label ||
            node.id,
          val:
            node.node_type === "vendor"
              ? Math.max(
                  8,
                  Number(
                    node.degree || 0
                  ) + 7
                )
              : Math.max(
                  5,
                  Number(
                    node.degree || 0
                  ) + 4
                ),
        })
      ),

      links: filteredEdges.map(
        (edge) => ({
          source: edge.source,
          target: edge.target,
          relationship:
            edge.relationship ||
            "related",
        })
      ),
    };
  }, [
    networkResult,
    relationshipFilter,
  ]);

  const selectedNeighbourIds =
    useMemo(() => {
      const ids = new Set();

      if (!selectedNode?.id) {
        return ids;
      }

      ids.add(selectedNode.id);

      graphData.links.forEach(
        (link) => {
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

          if (
            sourceId ===
            selectedNode.id
          ) {
            ids.add(targetId);
          }

          if (
            targetId ===
            selectedNode.id
          ) {
            ids.add(sourceId);
          }
        }
      );

      return ids;
    }, [
      selectedNode,
      graphData,
    ]);

  const selectedRelationships =
    useMemo(() => {
      if (!selectedNode?.id) {
        return [];
      }

      return graphData.links
        .filter((link) => {
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

          return (
            sourceId === selectedNode.id ||
            targetId === selectedNode.id
          );
        })
        .map((link) => {
          const source =
            typeof link.source ===
            "object"
              ? link.source
              : graphData.nodes.find(
                  (node) =>
                    node.id ===
                    link.source
                );

          const target =
            typeof link.target ===
            "object"
              ? link.target
              : graphData.nodes.find(
                  (node) =>
                    node.id ===
                    link.target
                );

          const connectedNode =
            source?.id ===
            selectedNode.id
              ? target
              : source;

          return {
            relationship:
              link.relationship,
            connectedNode,
          };
        });
    }, [
      selectedNode,
      graphData,
    ]);

  const handleNodeClick = (node) => {
    setSelectedNode(node);

    if (
      graphRef.current &&
      Number.isFinite(node.x) &&
      Number.isFinite(node.y)
    ) {
      graphRef.current.centerAt(
        node.x,
        node.y,
        600
      );

      graphRef.current.zoom(
        4,
        600
      );
    }
  };

  const resetGraph = () => {
    setSelectedNode(null);

    if (graphRef.current) {
      graphRef.current.zoomToFit(
        500,
        70
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

    const isVisible =
      selectedNeighbourIds.size === 0 ||
      selectedNeighbourIds.has(
        node.id
      );

    const radius =
      isSelected
        ? isVendor
          ? 12
          : 9
        : isVendor
        ? 8
        : 5;

    context.save();

    context.globalAlpha =
      isVisible ? 1 : 0.16;

    context.beginPath();

    context.arc(
      node.x,
      node.y,
      radius,
      0,
      2 * Math.PI
    );

    context.fillStyle =
      isSelected
        ? "#111827"
        : isVendor
        ? "#7C3AED"
        : getIdentifierColor(
            node.identifier_type
          );

    context.fill();

    context.lineWidth =
      isSelected ? 3 : 1;

    context.strokeStyle =
      "#FFFFFF";

    context.stroke();

    if (showLabels) {
      const fontSize =
        Math.max(
          11 / globalScale,
          2.3
        );

      context.font =
        `${fontSize}px Sans-Serif`;

      context.fillStyle =
        "#111827";

      context.textAlign =
        "left";

      context.textBaseline =
        "middle";

      const label =
        isVendor
          ? node.name
          : formatIdentifierType(
              node.identifier_type
            );

      context.fillText(
        label,
        node.x + radius + 2,
        node.y
      );
    }

    context.restore();
  };

  if (!open) {
    return null;
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={modalTitleStyle}>
              Network Relationship Graph
            </h2>

            <p style={modalSubtitleStyle}>
              {clientName || "Client"}
              {" • "}
              {datasetName || "Dataset"}
            </p>
          </div>

          <div style={headerActionsStyle}>
            <button
              className="secondary-btn"
              onClick={loadNetwork}
              disabled={loading}
            >
              Refresh
            </button>

            <button
              className="secondary-btn"
              onClick={resetGraph}
              disabled={loading}
            >
              Reset View
            </button>

            <button
              className="danger-btn"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div style={toolbarStyle}>
          <div style={toolbarGroupStyle}>
            <label style={toolbarLabelStyle}>
              Relationship
            </label>

            <select
              value={relationshipFilter}
              onChange={(event) => {
                setRelationshipFilter(
                  event.target.value
                );

                setSelectedNode(null);
              }}
              style={toolbarSelectStyle}
            >
              <option value="All">
                All Relationships
              </option>

              {relationshipTypes.map(
                (relationship) => (
                  <option
                    key={relationship}
                    value={relationship}
                  >
                    {formatIdentifierType(
                      relationship
                    )}
                  </option>
                )
              )}
            </select>
          </div>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(event) =>
                setShowLabels(
                  event.target.checked
                )
              }
            />

            Show labels
          </label>

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
              label="Bank"
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
        </div>

        <div style={modalContentStyle}>
          <div
            ref={graphContainerRef}
            style={graphPanelStyle}
          >
            {loading && (
              <div style={statusStateStyle}>
                <h3>
                  Loading network graph...
                </h3>
              </div>
            )}

            {!loading && error && (
              <div style={errorStateStyle}>
                <h3>
                  Unable to load graph
                </h3>

                <p>{error}</p>

                <button
                  className="primary-btn"
                  onClick={loadNetwork}
                >
                  Retry
                </button>
              </div>
            )}

            {!loading &&
              !error &&
              graphData.nodes.length ===
                0 && (
                <div style={statusStateStyle}>
                  <h3>
                    No network relationships
                  </h3>

                  <p>
                    This dataset has no shared
                    supported identifiers.
                  </p>
                </div>
              )}

            {!loading &&
              !error &&
              graphData.nodes.length >
                0 && (
                <ForceGraph2D
                  ref={graphRef}
                  graphData={graphData}
                  width={graphWidth}
                  height={getGraphHeight()}
                  backgroundColor="#FFFFFF"
                  warmupTicks={20}
                  cooldownTicks={120}
                  d3AlphaDecay={0.025}
                  d3VelocityDecay={0.35}
                  enableNodeDrag
                  enableZoomInteraction
                  enablePanInteraction
                  nodeRelSize={5}
                  nodeVal={(node) =>
                    node.val || 5
                  }
                  nodeCanvasObject={
                    renderNode
                  }
                  nodePointerAreaPaint={(
                    node,
                    color,
                    context
                  ) => {
                    context.fillStyle =
                      color;

                    context.beginPath();

                    context.arc(
                      node.x,
                      node.y,
                      node.node_type ===
                        "vendor"
                        ? 12
                        : 9,
                      0,
                      2 * Math.PI
                    );

                    context.fill();
                  }}
                  nodeLabel={(node) =>
                    buildNodeTooltip(node)
                  }
                  onNodeClick={
                    handleNodeClick
                  }
                  linkLabel={(link) =>
                    formatIdentifierType(
                      link.relationship
                    )
                  }
                  linkColor={(link) =>
                    getLinkColor(
                      link,
                      selectedNode
                    )
                  }
                  linkWidth={(link) =>
                    getLinkWidth(
                      link.relationship
                    )
                  }
                  linkDirectionalParticles={(
                    link
                  ) =>
                    isSelectedLink(
                      link,
                      selectedNode
                    )
                      ? 3
                      : 0
                  }
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
                      graphRef.current
                        .zoomToFit(
                          500,
                          70
                        );
                    }
                  }}
                />
              )}
          </div>

          <aside style={detailsPanelStyle}>
            {!selectedNode ? (
              <>
                <h3 style={{ marginTop: 0 }}>
                  Network Summary
                </h3>

                <SummaryRow
                  label="Vendors"
                  value={
                    networkResult?.summary
                      ?.vendor_nodes ?? 0
                  }
                />

                <SummaryRow
                  label="Identifiers"
                  value={
                    networkResult?.summary
                      ?.identifier_nodes ??
                    0
                  }
                />

                <SummaryRow
                  label="Relationships"
                  value={
                    networkResult?.summary
                      ?.total_edges ?? 0
                  }
                />

                <SummaryRow
                  label="Suspicious clusters"
                  value={
                    networkResult?.summary
                      ?.suspicious_clusters ??
                    0
                  }
                />

                <SummaryRow
                  label="Network findings"
                  value={
                    networkResult?.summary
                      ?.network_findings ??
                    0
                  }
                />

                <div style={instructionBoxStyle}>
                  Click a node to inspect its
                  direct relationships.
                </div>
              </>
            ) : (
              <>
                <div style={detailsHeadingStyle}>
                  <div>
                    <p style={smallLabelStyle}>
                      Selected node
                    </p>

                    <h3
                      style={{
                        margin:
                          "4px 0 0",
                      }}
                    >
                      {selectedNode.name ||
                        selectedNode.label ||
                        selectedNode.id}
                    </h3>
                  </div>

                  <button
                    className="secondary-btn"
                    onClick={() =>
                      setSelectedNode(null)
                    }
                  >
                    Clear
                  </button>
                </div>

                <SummaryRow
                  label="Type"
                  value={
                    selectedNode.node_type ===
                    "vendor"
                      ? "Vendor"
                      : formatIdentifierType(
                          selectedNode
                            .identifier_type
                        )
                  }
                />

                <SummaryRow
                  label="Degree"
                  value={
                    selectedNode.degree ?? 0
                  }
                />

                {selectedNode.vendor_id && (
                  <SummaryRow
                    label="Vendor ID"
                    value={
                      selectedNode.vendor_id
                    }
                  />
                )}

                {selectedNode
                  .identifier_value && (
                  <SummaryRow
                    label="Value"
                    value={
                      selectedNode
                        .identifier_value
                    }
                  />
                )}

                <h4>
                  Direct Relationships
                </h4>

                {selectedRelationships.length ===
                0 ? (
                  <p style={mutedTextStyle}>
                    No direct relationships.
                  </p>
                ) : (
                  <div style={relationshipListStyle}>
                    {selectedRelationships.map(
                      (
                        relationship,
                        index
                      ) => (
                        <div
                          key={index}
                          style={
                            relationshipItemStyle
                          }
                        >
                          <strong>
                            {formatIdentifierType(
                              relationship.relationship
                            )}
                          </strong>

                          <span>
                            {relationship
                              .connectedNode
                              ?.name ||
                              relationship
                                .connectedNode
                                ?.label ||
                              relationship
                                .connectedNode
                                ?.id ||
                              "-"}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}


function SummaryRow({
  label,
  value,
}) {
  return (
    <div style={summaryRowStyle}>
      <span style={mutedTextStyle}>
        {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}


function LegendItem({
  color,
  label,
}) {
  return (
    <span style={legendItemStyle}>
      <span
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />

      {label}
    </span>
  );
}


function getGraphHeight() {
  return Math.max(
    420,
    window.innerHeight - 250
  );
}


function getIdentifierColor(type) {
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


function getLinkWidth(
  relationship
) {
  if (
    relationship ===
    "bank_account"
  ) {
    return 2.8;
  }

  if (
    relationship === "gst" ||
    relationship === "pan"
  ) {
    return 2;
  }

  return 1.2;
}


function isSelectedLink(
  link,
  selectedNode
) {
  if (!selectedNode?.id) {
    return false;
  }

  const sourceId =
    typeof link.source === "object"
      ? link.source.id
      : link.source;

  const targetId =
    typeof link.target === "object"
      ? link.target.id
      : link.target;

  return (
    sourceId === selectedNode.id ||
    targetId === selectedNode.id
  );
}


function getLinkColor(
  link,
  selectedNode
) {
  if (!selectedNode) {
    return "#CBD5E1";
  }

  return isSelectedLink(
    link,
    selectedNode
  )
    ? "#7C3AED"
    : "#E5E7EB";
}


function buildNodeTooltip(node) {
  const label =
    node.name ||
    node.label ||
    node.id;

  if (
    node.node_type ===
    "vendor"
  ) {
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


function formatIdentifierType(
  value
) {
  if (!value) {
    return "-";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}


const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "18px",
  background:
    "rgba(15, 23, 42, 0.72)",
  backdropFilter: "blur(4px)",
};


const modalStyle = {
  width: "min(1500px, 96vw)",
  height: "92vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "#FFFFFF",
  borderRadius: "22px",
  boxShadow:
    "0 30px 80px rgba(15, 23, 42, 0.35)",
};


const modalHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  padding: "18px 22px",
  borderBottom:
    "1px solid #E5E7EB",
};


const modalTitleStyle = {
  margin: 0,
  fontSize: "22px",
};


const modalSubtitleStyle = {
  margin: "5px 0 0",
  color: "#6B7280",
};


const headerActionsStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};


const toolbarStyle = {
  minHeight: "60px",
  display: "flex",
  alignItems: "center",
  gap: "18px",
  flexWrap: "wrap",
  padding: "10px 22px",
  background: "#F8FAFC",
  borderBottom:
    "1px solid #E5E7EB",
};


const toolbarGroupStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};


const toolbarLabelStyle = {
  fontSize: "13px",
  fontWeight: 700,
};


const toolbarSelectStyle = {
  minWidth: "180px",
};


const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  fontSize: "13px",
  fontWeight: 600,
};


const legendStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};


const legendItemStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "12px",
  color: "#475569",
};


const modalContentStyle = {
  minHeight: 0,
  flex: 1,
  display: "grid",
  gridTemplateColumns:
    "minmax(0, 1fr) minmax(240px, 310px)",
  overflow: "hidden",
};


const graphPanelStyle = {
  minWidth: 0,
  height: "100%",
  position: "relative",
  overflow: "hidden",
  background: "#FFFFFF",
};


const detailsPanelStyle = {
  height: "100%",
  overflowY: "auto",
  padding: "18px",
  background: "#F8FAFC",
  borderLeft:
    "1px solid #E5E7EB",
};


const statusStateStyle = {
  height: "100%",
  minHeight: "420px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: "#64748B",
};


const errorStateStyle = {
  ...statusStateStyle,
  color: "#B91C1C",
};


const detailsHeadingStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "10px",
};


const smallLabelStyle = {
  margin: 0,
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#64748B",
};


const summaryRowStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "14px",
  padding: "11px 0",
  borderBottom:
    "1px solid #E5E7EB",
};


const mutedTextStyle = {
  color: "#64748B",
};


const instructionBoxStyle = {
  marginTop: "18px",
  padding: "14px",
  borderRadius: "14px",
  background: "#EDE9FE",
  color: "#5B21B6",
  fontSize: "13px",
  lineHeight: 1.5,
};


const relationshipListStyle = {
  display: "grid",
  gap: "9px",
};


const relationshipItemStyle = {
  display: "grid",
  gap: "4px",
  padding: "11px",
  borderRadius: "12px",
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  fontSize: "13px",
};