import { useEffect, useMemo, useRef, useState } from "react";
import {
  askCopilot,
  getCopilotContext,
  getCopilotHistory,
} from "../services/copilotService";
import "./CopilotPage.css";

const STARTER_PROMPTS = [
  "Summarize the current audit scope and tell me what needs attention first.",
  "Which findings should I review first and why?",
  "What should I verify next for the selected dataset?",
  "Summarize the current findings for management.",
];

export default function CopilotPage() {
  const [context, setContext] = useState({ clients: [], datasets: [] });
  const [clientId, setClientId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadInitialData = async () => {
    try {
      setContextLoading(true);
      const [selectorData, historyData] = await Promise.all([
        getCopilotContext(),
        getCopilotHistory(10),
      ]);

      setContext({
        clients: Array.isArray(selectorData?.clients) ? selectorData.clients : [],
        datasets: Array.isArray(selectorData?.datasets) ? selectorData.datasets : [],
      });

      if (Array.isArray(historyData)) {
        setMessages(
          historyData
            .slice()
            .reverse()
            .flatMap((item) => [
              { role: "user", text: item.question },
              {
                role: "assistant",
                text: item.answer,
                intent: item.intent,
                sources: item.sources || [],
              },
            ])
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setContextLoading(false);
    }
  };

  const availableDatasets = useMemo(() => {
    if (!clientId) return context.datasets || [];
    return (context.datasets || []).filter(
      (dataset) => String(dataset.client_id) === String(clientId)
    );
  }, [context.datasets, clientId]);

  const selectedDataset = useMemo(
    () => availableDatasets.find((item) => String(item.id) === String(datasetId)),
    [availableDatasets, datasetId]
  );

  const submitQuestion = async (overrideQuestion) => {
    const text = String(overrideQuestion ?? question).trim();
    if (!text) return;

    if (datasetId && selectedDataset && !selectedDataset.has_current_assessment) {
      alert("The selected dataset has not been assessed yet. Run an analysis before asking Copilot about its findings.");
      return;
    }

    setMessages((current) => [...current, { role: "user", text }]);
    setQuestion("");
    setLoading(true);

    try {
      const result = await askCopilot({
        question: text,
        clientId: clientId || null,
        datasetId: datasetId || null,
        transactionId: transactionId || null,
      });

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.answer,
          intent: result.intent,
          sources: result.sources || [],
          agentPlan: result.agent_plan,
        },
      ]);
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail || "Copilot could not answer this question.";
      setMessages((current) => [
        ...current,
        { role: "assistant", text: `Unable to complete the request: ${detail}`, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="copilot-page">
      <header className="copilot-header">
        <div>
          <p className="copilot-eyebrow">Agentic RAG</p>
          <h1>Audit Copilot</h1>
          <p>Ask questions about the current audit, findings and recommended audit procedures.</p>
        </div>
        <button className="secondary-btn" onClick={() => setMessages([])}>Clear View</button>
      </header>

      <div className="copilot-layout">
        <aside className="copilot-context-card">
          <h2>Audit Context</h2>
          <p>Copilot automatically uses the latest completed assessment for the selected dataset.</p>

          <label>Client</label>
          <select
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setDatasetId("");
              setTransactionId("");
            }}
            disabled={contextLoading}
          >
            <option value="">All Clients</option>
            {context.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.client_code ? `${client.client_code} - ` : ""}{client.client_name}
              </option>
            ))}
          </select>

          <label>Dataset</label>
          <select
            value={datasetId}
            onChange={(event) => {
              setDatasetId(event.target.value);
              setTransactionId("");
            }}
            disabled={contextLoading}
          >
            <option value="">Current scope / all datasets</option>
            {availableDatasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.dataset_name}{dataset.has_current_assessment ? "" : " (Not assessed)"}
              </option>
            ))}
          </select>

          <label>Transaction ID <span>(optional)</span></label>
          <input
            value={transactionId}
            onChange={(event) => setTransactionId(event.target.value)}
            placeholder="e.g. 9944"
          />

          {selectedDataset && (
            <div className={`copilot-context-status ${selectedDataset.has_current_assessment ? "ready" : "pending"}`}>
              {selectedDataset.has_current_assessment ? (
                <>
                  <strong>Current assessment available</strong>
                  <span>{formatDate(selectedDataset.current_assessment_at)}</span>
                </>
              ) : (
                <>
                  <strong>Assessment required</strong>
                  <span>Run analysis before asking finding-specific questions.</span>
                </>
              )}
            </div>
          )}

          <div className="copilot-agent-note">
            <strong>How it works</strong>
            <span>Copilot plans the request, retrieves current audit data and/or audit knowledge, then creates a grounded response.</span>
          </div>
        </aside>

        <section className="copilot-chat-card">
          <div className="copilot-chat-scroll">
            {messages.length === 0 && (
              <div className="copilot-welcome">
                <div className="copilot-icon">✦</div>
                <h2>What would you like to review?</h2>
                <p>Select a client or dataset when you want the answer grounded in a specific audit.</p>
                <div className="copilot-starter-grid">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button key={prompt} onClick={() => submitQuestion(prompt)}>{prompt}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <MessageBubble key={`${message.role}-${index}`} message={message} />
            ))}

            {loading && (
              <div className="copilot-message assistant">
                <div className="copilot-message-label">Audit Copilot</div>
                <div className="copilot-typing">Reviewing the current audit context...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="copilot-composer">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!loading) submitQuestion();
                }
              }}
              placeholder="Ask about findings, a transaction, audit procedures, vendor relationships or management summary..."
              rows={3}
              disabled={loading}
            />
            <button className="primary-btn" onClick={() => submitQuestion()} disabled={loading || !question.trim()}>
              {loading ? "Reviewing..." : "Ask Copilot"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  return (
    <div className={`copilot-message ${message.role} ${message.error ? "error" : ""}`}>
      <div className="copilot-message-label">{message.role === "user" ? "You" : "Audit Copilot"}</div>
      <div className="copilot-message-text">{message.text}</div>
      {message.role === "assistant" && !message.error && (
        <>
          {message.intent && <div className="copilot-intent-chip">{humanizeIntent(message.intent)}</div>}
          {message.sources?.length > 0 && (
            <details className="copilot-sources">
              <summary>Evidence used ({message.sources.length})</summary>
              <ul>
                {message.sources.map((source, index) => (
                  <li key={index}>
                    {source.type === "current_assessment"
                      ? `Current assessment • ${shortId(source.analysis_id)}`
                      : `Audit guidance • ${source.source || "knowledge base"}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function humanizeIntent(intent) {
  return String(intent || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortId(value) {
  return value ? String(value).slice(0, 8) : "-";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en-IN") : "-";
}
