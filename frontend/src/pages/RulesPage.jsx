import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getClients } from "../services/clientService";
import {
  getClientRules,
  updateClientRule,
  createCustomRule,
} from "../services/clientRuleService";

const emptyCondition = {
  field: "",
  operator: ">",
  value: "",
};

const emptyCustomRule = {
  rule_name: "",
  description: "",
  custom_threshold: "",
  likelihood: 3,
  impact: 3,
  logic: "AND",
  conditions: [{ ...emptyCondition }],
};

export default function RulesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ruleSearch, setRuleSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [customRule, setCustomRule] = useState(emptyCustomRule);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    const clientIdFromUrl = searchParams.get("clientId");
    if (clientIdFromUrl) loadRules(clientIdFromUrl);
  }, [searchParams]);

  const selectedClientDetails = useMemo(
    () => clients.find((client) => client.id === selectedClient),
    [clients, selectedClient]
  );

  const filteredRules = useMemo(() => {
    return rules.filter((item) => {
      const rule = item.rules || {};
      const text = `${rule.rule_name || ""} ${rule.rule_type || ""} ${
        rule.rule_category || ""
      }`.toLowerCase();

      return (
        text.includes(ruleSearch.toLowerCase()) &&
        (typeFilter === "All" || rule.rule_type === typeFilter)
      );
    });
  }, [rules, ruleSearch, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: rules.length,
      system: rules.filter((rule) => rule.rules?.rule_type === "SYSTEM").length,
      custom: rules.filter((rule) => rule.rules?.rule_type === "CUSTOM").length,
      enabled: rules.filter((rule) => rule.enabled).length,
    };
  }, [rules]);

  const loadClients = async () => {
    const data = await getClients();
    setClients(Array.isArray(data) ? data : []);
  };

  const loadRules = async (clientId) => {
    setSelectedClient(clientId);

    if (!clientId) {
      setRules([]);
      return;
    }

    try {
      setLoading(true);
      const data = await getClientRules(clientId);
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      alert("Failed to load rules.");
    } finally {
      setLoading(false);
    }
  };

  const updateCondition = (index, field, value) => {
    const updatedConditions = [...customRule.conditions];

    updatedConditions[index] = {
      ...updatedConditions[index],
      [field]: value,
    };

    if (field === "operator" && ["is_null", "not_null"].includes(value)) {
      updatedConditions[index].value = "";
    }

    setCustomRule({
      ...customRule,
      conditions: updatedConditions,
    });
  };

  const addCondition = () => {
    setCustomRule({
      ...customRule,
      conditions: [...customRule.conditions, { ...emptyCondition }],
    });
  };

  const removeCondition = (index) => {
    if (customRule.conditions.length === 1) {
      alert("At least one condition is required.");
      return;
    }

    setCustomRule({
      ...customRule,
      conditions: customRule.conditions.filter((_, i) => i !== index),
    });
  };

  const validateCustomRule = () => {
    if (!selectedClient) return "Please select a client first.";
    if (!customRule.rule_name.trim()) return "Rule name is required.";

    const likelihood = Number(customRule.likelihood);
    const impact = Number(customRule.impact);

    if (likelihood < 1 || likelihood > 5) {
      return "Likelihood must be between 1 and 5.";
    }

    if (impact < 1 || impact > 5) {
      return "Impact must be between 1 and 5.";
    }

    for (const condition of customRule.conditions) {
      if (!condition.field.trim()) {
        return "Every condition needs a dataset column.";
      }

      if (!condition.operator) {
        return "Every condition needs an operator.";
      }

      if (
        !["is_null", "not_null"].includes(condition.operator) &&
        String(condition.value).trim() === ""
      ) {
        return "Comparison value is required unless operator is is_null or not_null.";
      }
    }

    return null;
  };

  const handleRuleChange = (index, field, value) => {
    const updated = [...rules];
    updated[index][field] = value;
    setRules(updated);
  };

  const saveRule = async (rule) => {
    try {
      await updateClientRule(rule.id, {
        custom_threshold:
          rule.custom_threshold === "" ? null : Number(rule.custom_threshold),
        likelihood: Number(rule.likelihood),
        impact: Number(rule.impact),
        enabled: Boolean(rule.enabled),
      });

      alert("Rule updated successfully");
      loadRules(selectedClient);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || "Failed to update rule.");
    }
  };

  const addCustomRule = async () => {
    const error = validateCustomRule();

    if (error) {
      alert(error);
      return;
    }

    const conditions = customRule.conditions.map((condition) => {
      const cleaned = {
        field: condition.field.trim(),
        operator: condition.operator,
      };

      if (!["is_null", "not_null"].includes(condition.operator)) {
        cleaned.value = condition.value;
      }

      return cleaned;
    });

    try {
      await createCustomRule({
        client_id: selectedClient,
        rule_name: customRule.rule_name.trim(),
        description: customRule.description.trim(),
        custom_threshold:
          customRule.custom_threshold === ""
            ? null
            : Number(customRule.custom_threshold),
        likelihood: Number(customRule.likelihood),
        impact: Number(customRule.impact),
        rule_definition: {
          logic: customRule.logic,
          conditions,
        },
      });

      alert("Custom rule added successfully");
      setCustomRule(emptyCustomRule);
      loadRules(selectedClient);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || "Failed to create custom rule.");
    }
  };

  const renderConditions = (ruleDefinition) => {
    const conditions = ruleDefinition?.conditions;
    const logic = ruleDefinition?.logic || "AND";

    if (!Array.isArray(conditions) || conditions.length === 0) return "-";

    return (
      <div>
        <span className="badge badge-medium">{logic}</span>
        <ul style={{ marginTop: "8px" }}>
          {conditions.map((condition, index) => (
            <li key={index}>
              {condition.field} {condition.operator}{" "}
              {condition.value !== undefined ? String(condition.value) : ""}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const getRulePreview = () => {
    const previewParts = customRule.conditions.map((condition) => {
      if (!condition.field.trim()) return "column";

      if (["is_null", "not_null"].includes(condition.operator)) {
        return `${condition.field} ${condition.operator}`;
      }

      return `${condition.field} ${condition.operator} ${
        condition.value || "value"
      }`;
    });

    return `IF ${previewParts.join(
      ` ${customRule.logic} `
    )} THEN flag transaction.`;
  };

  return (
    <div>
      <h1 className="page-title">Rules Management</h1>
      <p className="page-subtitle">
        Configure default and custom audit rules for each client. Rules define
        what the platform should flag during audit analysis.
      </p>

      <div className="nav-actions">
        <button className="secondary-btn" onClick={() => navigate("/clients")}>
          ← Back to Client Management
        </button>

        <button className="primary-btn" onClick={() => navigate("/upload")}>
          Upload Dataset →
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Select Audit Client</h2>

        <select
          value={selectedClient}
          onChange={(event) => loadRules(event.target.value)}
        >
          <option value="">-- Select Client --</option>

          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.client_code || "NO-CODE"} - {client.client_name}
            </option>
          ))}
        </select>

        {selectedClientDetails && (
          <p style={{ color: "#6B7280" }}>
            Managing rules for <strong>{selectedClientDetails.client_name}</strong>
          </p>
        )}
      </div>

      <div style={statsGridStyle}>
        <StatCard title="Total Rules" value={stats.total} />
        <StatCard title="System Rules" value={stats.system} />
        <StatCard title="Custom Rules" value={stats.custom} />
        <StatCard title="Enabled Rules" value={stats.enabled} />
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2 style={{ marginTop: 0 }}>Client Rules</h2>

        <div className="form-grid">
          <input
            placeholder="Search rule name, type, or category..."
            value={ruleSearch}
            onChange={(event) => setRuleSearch(event.target.value)}
          />

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="All">All Rule Types</option>
            <option value="SYSTEM">System Rules</option>
            <option value="CUSTOM">Custom Rules</option>
          </select>
        </div>

        {loading && <p>Loading rules...</p>}
        {!selectedClient && <p>Please select a client to view rules.</p>}
        {selectedClient && filteredRules.length === 0 && !loading && (
          <p>No matching rules found.</p>
        )}

        {filteredRules.length > 0 && (
          <div className="table-wrap" style={{ marginTop: "18px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Conditions</th>
                  <th>Reference Threshold</th>
                  <th>Likelihood</th>
                  <th>Impact</th>
                  <th>Risk Score</th>
                  <th>Enabled</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRules.map((rule) => {
                  const originalIndex = rules.findIndex(
                    (item) => item.id === rule.id
                  );

                  return (
                    <tr key={rule.id}>
                      <td>{rule.rules?.rule_name || "-"}</td>
                      <td>
                        <span
                          className={
                            rule.rules?.rule_type === "CUSTOM"
                              ? "badge badge-medium"
                              : "badge badge-low"
                          }
                        >
                          {rule.rules?.rule_type || "-"}
                        </span>
                      </td>
                      <td>{rule.rules?.rule_category || "-"}</td>
                      <td>{renderConditions(rule.rules?.rule_definition)}</td>

                      <td>
                        <input
                          type="number"
                          value={rule.custom_threshold ?? ""}
                          onChange={(event) =>
                            handleRuleChange(
                              originalIndex,
                              "custom_threshold",
                              event.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={rule.likelihood || 1}
                          onChange={(event) =>
                            handleRuleChange(
                              originalIndex,
                              "likelihood",
                              event.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={rule.impact || 1}
                          onChange={(event) =>
                            handleRuleChange(
                              originalIndex,
                              "impact",
                              event.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <strong>
                          {Number(rule.likelihood || 0) *
                            Number(rule.impact || 0)}
                        </strong>
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(rule.enabled)}
                          onChange={(event) =>
                            handleRuleChange(
                              originalIndex,
                              "enabled",
                              event.target.checked
                            )
                          }
                        />
                      </td>

                      <td>
                        <button
                          className="primary-btn"
                          onClick={() => saveRule(rule)}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2 style={{ marginTop: 0 }}>Add Custom Rule</h2>

        <div className="help-box">
          <strong>How custom rules work:</strong>
          <p>
            A custom rule is an IF condition applied to each transaction.
            Example: <code>amount &gt; 1000000</code> flags transactions where
            the amount is greater than 10,00,000.
          </p>
          <p>
            Multiple conditions can be joined using <strong>AND</strong> or{" "}
            <strong>OR</strong>. The risk score is calculated as Likelihood ×
            Impact.
          </p>
        </div>

        {!selectedClient && (
          <p style={{ color: "#B45309" }}>
            Select a client before adding a custom rule.
          </p>
        )}

        <div className="form-grid">
          <div>
            <label>Rule Name *</label>
            <input
              placeholder="Example: High Medical Payment"
              value={customRule.rule_name}
              onChange={(event) =>
                setCustomRule({ ...customRule, rule_name: event.target.value })
              }
            />
          </div>

          <div>
            <label>Description</label>
            <input
              placeholder="Explain why this rule matters"
              value={customRule.description}
              onChange={(event) =>
                setCustomRule({
                  ...customRule,
                  description: event.target.value,
                })
              }
            />
          </div>

          <div>
            <label>Reference Threshold Optional</label>
            <input
              type="number"
              placeholder="Example: 1000000"
              value={customRule.custom_threshold}
              onChange={(event) =>
                setCustomRule({
                  ...customRule,
                  custom_threshold: event.target.value,
                })
              }
            />
          </div>

          <div>
            <label>Logic</label>
            <select
              value={customRule.logic}
              onChange={(event) =>
                setCustomRule({ ...customRule, logic: event.target.value })
              }
            >
              <option value="AND">AND - all conditions must match</option>
              <option value="OR">OR - any condition can match</option>
            </select>
          </div>

          <div>
            <label>Likelihood 1–5 *</label>
            <input
              type="number"
              min="1"
              max="5"
              value={customRule.likelihood}
              onChange={(event) =>
                setCustomRule({
                  ...customRule,
                  likelihood: event.target.value,
                })
              }
            />
          </div>

          <div>
            <label>Impact 1–5 *</label>
            <input
              type="number"
              min="1"
              max="5"
              value={customRule.impact}
              onChange={(event) =>
                setCustomRule({ ...customRule, impact: event.target.value })
              }
            />
          </div>
        </div>

        <h3>Conditions</h3>

        {customRule.conditions.map((condition, index) => (
          <div className="card" key={index} style={conditionCardStyle}>
            <div style={conditionHeaderStyle}>
              <strong>Condition {index + 1}</strong>

              <button
                className="danger-btn"
                onClick={() => removeCondition(index)}
              >
                Remove Condition
              </button>
            </div>

            <div className="form-grid">
              <div>
                <label>Dataset Column *</label>
                <input
                  placeholder="Example: amount"
                  value={condition.field}
                  onChange={(event) =>
                    updateCondition(index, "field", event.target.value)
                  }
                />
              </div>

              <div>
                <label>Operator *</label>
                <select
                  value={condition.operator}
                  onChange={(event) =>
                    updateCondition(index, "operator", event.target.value)
                  }
                >
                  <option value=">">greater than &gt;</option>
                  <option value="<">less than &lt;</option>
                  <option value=">=">greater than or equal &gt;=</option>
                  <option value="<=">less than or equal &lt;=</option>
                  <option value="=">equals =</option>
                  <option value="!=">not equal !=</option>
                  <option value="is_null">is empty / missing</option>
                  <option value="not_null">is not empty</option>
                </select>
              </div>

              <div>
                <label>Comparison Value</label>
                <input
                  placeholder="Example: 1000000"
                  value={condition.value}
                  disabled={["is_null", "not_null"].includes(
                    condition.operator
                  )}
                  onChange={(event) =>
                    updateCondition(index, "value", event.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}

        <button className="secondary-btn" onClick={addCondition}>
          + Add Another Condition
        </button>

        <div className="preview-box">
          <strong>Rule Preview</strong>
          <p>{getRulePreview()}</p>
          <p>
            Risk Score = {Number(customRule.likelihood || 0)} ×{" "}
            {Number(customRule.impact || 0)} ={" "}
            <strong>
              {Number(customRule.likelihood || 0) *
                Number(customRule.impact || 0)}
            </strong>
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={addCustomRule}
          disabled={!selectedClient}
        >
          Add Custom Rule
        </button>
      </div>
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

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
  marginTop: "24px",
};

const conditionCardStyle = {
  marginBottom: "14px",
  boxShadow: "none",
};

const conditionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "14px",
  flexWrap: "wrap",
};