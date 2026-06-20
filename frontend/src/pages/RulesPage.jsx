import { useEffect, useState } from "react";
import { getClients } from "../services/clientService";
import {
  getClientRules,
  updateClientRule,
  createCustomRule,
} from "../services/clientRuleService";

export default function RulesPage() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [rules, setRules] = useState([]);

  const [customRule, setCustomRule] = useState({
    rule_name: "",
    description: "",
    custom_threshold: 0,
    likelihood: 3,
    impact: 3,
    field: "",
    operator: ">",
    value: "",
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const data = await getClients();
    setClients(data);
  };

  const loadRules = async (clientId) => {
    setSelectedClient(clientId);
    const data = await getClientRules(clientId);
    setRules(data);
  };

  const handleRuleChange = (index, field, value) => {
    const updated = [...rules];
    updated[index][field] = value;
    setRules(updated);
  };

  const saveRule = async (rule) => {
    await updateClientRule(rule.id, {
      custom_threshold: Number(rule.custom_threshold || 0),
      likelihood: Number(rule.likelihood),
      impact: Number(rule.impact),
      enabled: Boolean(rule.enabled),
    });

    alert("Rule updated successfully");
    loadRules(selectedClient);
  };

  const addCustomRule = async () => {
    if (!selectedClient) {
      alert("Please select a client first");
      return;
    }

    await createCustomRule({
      client_id: selectedClient,
      rule_name: customRule.rule_name,
      description: customRule.description,
      custom_threshold: Number(customRule.custom_threshold),
      likelihood: Number(customRule.likelihood),
      impact: Number(customRule.impact),
      rule_definition: {
        conditions: [
          {
            field: customRule.field,
            operator: customRule.operator,
            value: customRule.value,
          },
        ],
      },
    });

    alert("Custom rule added successfully");

    setCustomRule({
      rule_name: "",
      description: "",
      custom_threshold: 0,
      likelihood: 3,
      impact: 3,
      field: "",
      operator: ">",
      value: "",
    });

    loadRules(selectedClient);
  };

  return (
    <div>
      <h1>Rules Management</h1>

      <div style={{ marginBottom: "20px" }}>
        <label>Select Client: </label>

        <select
          value={selectedClient}
          onChange={(e) => loadRules(e.target.value)}
        >
          <option value="">-- Select Client --</option>

          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.client_code} - {client.client_name}
            </option>
          ))}
        </select>
      </div>

      <h2>Client Rules</h2>

      <table border="1" cellPadding="8" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Rule Name</th>
            <th>Threshold</th>
            <th>Likelihood</th>
            <th>Impact</th>
            <th>Risk Score</th>
            <th>Enabled</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rules.map((rule, index) => (
            <tr key={rule.id}>
              <td>{rule.rules?.rule_name}</td>

              <td>
                <input
                  type="number"
                  value={rule.custom_threshold || 0}
                  onChange={(e) =>
                    handleRuleChange(index, "custom_threshold", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={rule.likelihood || 1}
                  onChange={(e) =>
                    handleRuleChange(index, "likelihood", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={rule.impact || 1}
                  onChange={(e) =>
                    handleRuleChange(index, "impact", e.target.value)
                  }
                />
              </td>

              <td>{Number(rule.likelihood || 0) * Number(rule.impact || 0)}</td>

              <td>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) =>
                    handleRuleChange(index, "enabled", e.target.checked)
                  }
                />
              </td>

              <td>
                <button onClick={() => saveRule(rule)}>Save</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr style={{ margin: "30px 0" }} />

      <h2>Add Custom Rule</h2>

      <div>
        <input
          placeholder="Rule Name"
          value={customRule.rule_name}
          onChange={(e) =>
            setCustomRule({ ...customRule, rule_name: e.target.value })
          }
        />

        <input
          placeholder="Description"
          value={customRule.description}
          onChange={(e) =>
            setCustomRule({ ...customRule, description: e.target.value })
          }
        />

        <input
          type="number"
          placeholder="Threshold"
          value={customRule.custom_threshold}
          onChange={(e) =>
            setCustomRule({
              ...customRule,
              custom_threshold: e.target.value,
            })
          }
        />

        <input
          placeholder="Field"
          value={customRule.field}
          onChange={(e) =>
            setCustomRule({ ...customRule, field: e.target.value })
          }
        />

        <select
          value={customRule.operator}
          onChange={(e) =>
            setCustomRule({ ...customRule, operator: e.target.value })
          }
        >
          <option value=">">{">"}</option>
          <option value="<">{"<"}</option>
          <option value="=">=</option>
          <option value="is_null">is_null</option>
          <option value="not_null">not_null</option>
        </select>

        <input
          placeholder="Value"
          value={customRule.value}
          onChange={(e) =>
            setCustomRule({ ...customRule, value: e.target.value })
          }
        />

        <input
          type="number"
          min="1"
          max="5"
          placeholder="Likelihood"
          value={customRule.likelihood}
          onChange={(e) =>
            setCustomRule({ ...customRule, likelihood: e.target.value })
          }
        />

        <input
          type="number"
          min="1"
          max="5"
          placeholder="Impact"
          value={customRule.impact}
          onChange={(e) =>
            setCustomRule({ ...customRule, impact: e.target.value })
          }
        />

        <button onClick={addCustomRule}>Add Custom Rule</button>
      </div>
    </div>
  );
}