from __future__ import annotations

import json
import os
import re
from typing import Any, cast

from fastapi import HTTPException
from groq import Groq

from app.core.supabase_client import supabase
from app.services.copilot_context_service import CopilotContextService
from app.services.rag_service import RAGService


class CopilotService:
    APPLICATION_PAGES = {
        "Dashboard": {
            "route": "/dashboard",
            "purpose": "Review overall/current audit position, portfolio KPIs and priority findings.",
        },
        "Clients": {
            "route": "/clients",
            "purpose": "View client records and client context.",
        },
        "Rules": {
            "route": "/rules",
            "purpose": "Review configured audit checks and client-specific rules.",
        },
        "Upload": {
            "route": "/upload",
            "purpose": "Upload CSV, XLSX or JSON datasets for audit analysis.",
        },
        "Datasets": {
            "route": "/datasets",
            "purpose": "View uploaded datasets and dataset metadata.",
        },
        "Analysis": {
            "route": "/analysis",
            "purpose": "Run or review the current dataset assessment.",
        },
        "Findings": {
            "route": "/investigation",
            "purpose": "Investigate transaction-level findings, risk scores, reasons and triggered audit checks.",
        },
        "Vendor Risk": {
            "route": "/vendor-risk",
            "purpose": "Review vendor-focused risk information available in the application.",
        },
        "Network Analysis": {
            "route": "/network",
            "purpose": "Review vendor/entity relationships, shared identifiers and suspicious clusters.",
        },
        "Reports": {
            "route": "/reports",
            "purpose": "Generate current internal-audit analytics reports.",
        },
        "AI Copilot": {
            "route": "/copilot",
            "purpose": "Ask grounded audit questions using current audit data and audit guidance.",
        },
        "Settings": {
            "route": "/settings",
            "purpose": "Admin-only platform settings and role overview.",
        },
    }

    MODEL = os.getenv(
        "GROQ_MODEL",
        "llama-3.3-70b-versatile",
    )

    @staticmethod
    def _client() -> Groq:
        api_key = os.getenv("GROQ_API_KEY")

        if not api_key:
            raise HTTPException(
                status_code=500,
                detail=(
                    "GROQ_API_KEY is not configured in backend/.env."
                ),
            )

        return Groq(api_key=api_key)

    @staticmethod
    def get_selector_context():
        return CopilotContextService.get_selector_context()

    @staticmethod
    def ask(
        question: str,
        client_id: str | None,
        dataset_id: str | None,
        transaction_id: str | None,
        user_id: str | None,
        user_role: str | None,
    ) -> dict[str, Any]:
        question = question.strip()

        if not question:
            raise HTTPException(
                status_code=400,
                detail="Question is required.",
            )

        resolved_client = None

        if not transaction_id:
            transaction_id = (
                CopilotService
                ._resolve_transaction_from_question(
                    question
                )
            )

        if not client_id:
            resolved_client = (
                CopilotContextService
                .resolve_client_from_question(
                    question
                )
            )

            if resolved_client:
                client_id = str(
                    resolved_client.get(
                        "id"
                    )
                )

        plan = CopilotService._create_plan(
            question=question,
            client_id=client_id,
            dataset_id=dataset_id,
            transaction_id=transaction_id,
        )

        recent_conversation = (
            CopilotService
            ._recent_conversation(
                user_id=user_id,
                limit=3,
            )
        )

        live_context: dict[str, Any] = {}
        network_context: dict[str, Any] = {}
        findings_summary_context: dict[str, Any] = {}

        if plan["use_live_data"]:
            live_context = CopilotContextService.build_live_context(
                client_id=client_id,
                dataset_id=dataset_id,
                transaction_id=transaction_id,
                include_findings=plan["include_findings"],
                max_findings=12,
            )

        if plan["use_network_data"]:
            network_context = CopilotContextService.build_network_context(
                client_id=client_id,
                dataset_id=dataset_id,
            )

        if plan["use_findings_summary"]:
            findings_summary_context = (
                CopilotContextService
                .build_findings_summary_context(
                    client_id=client_id,
                    dataset_id=dataset_id,
                )
            )

        knowledge: list[dict[str, Any]] = []

        if plan["use_rag"]:
            knowledge = RAGService.search(
                question,
                limit=3,
            )

        answer = CopilotService._generate_answer(
            question=question,
            plan=plan,
            live_context=live_context,
            network_context=network_context,
            findings_summary_context=findings_summary_context,
            knowledge=knowledge,
            user_role=user_role,
            recent_conversation=recent_conversation,
        )

        sources = CopilotService._build_sources(
            live_context=live_context,
            network_context=network_context,
            findings_summary_context=findings_summary_context,
            knowledge=knowledge,
        )

        actions = (
            CopilotService
            ._build_actions(
                intent=plan[
                    "intent"
                ],
                client_id=client_id,
                dataset_id=dataset_id,
                transaction_id=transaction_id,
                findings_summary_context=findings_summary_context,
                network_context=network_context,
            )
        )

        analysis_id = CopilotService._single_current_analysis_id(
            live_context
        )

        if (
            not analysis_id
            and dataset_id
            and network_context
        ):
            network_results = (
                network_context.get("network_results")
                or []
            )

            if len(network_results) == 1:
                analysis_id = str(
                    network_results[0].get("current_analysis_id")
                    or ""
                ) or None

        CopilotService._save_history(
            user_id=user_id,
            client_id=client_id,
            dataset_id=dataset_id,
            analysis_id=analysis_id,
            question=question,
            answer=answer,
            intent=plan["intent"],
            sources=sources,
        )

        return {
            "answer": answer,
            "intent": plan["intent"],
            "agent_plan": {
                "used_current_audit_data": plan["use_live_data"],
                "used_network_analysis": plan["use_network_data"],
                "used_findings_summary": plan["use_findings_summary"],
                "used_audit_knowledge": plan["use_rag"],
                "used_findings": plan["include_findings"],
            },
            "current_analysis_id": analysis_id,
            "resolved_scope": {
                "client_id": client_id,
                "dataset_id": dataset_id,
                "transaction_id": transaction_id,
            },
            "actions": actions,
            "sources": sources,
        }


    @staticmethod
    def _resolve_transaction_from_question(
        question: str,
    ) -> str | None:
        """
        Resolve transaction identifiers directly from natural-language questions.

        Examples:
        - "Why is transaction 9944 risky?"
        - "Explain TXN006"
        - "What happened with txn 019?"
        """
        patterns = [
            r"\btransaction\s*(?:id\s*)?[:#-]?\s*([A-Za-z0-9_-]+)\b",
            r"\btxn\s*[:#-]?\s*([A-Za-z0-9_-]+)\b",
            r"\b(TXN[A-Za-z0-9_-]+)\b",
        ]

        for pattern in patterns:
            match = re.search(
                pattern,
                question,
                flags=re.IGNORECASE,
            )

            if match:
                return str(
                    match.group(1)
                ).strip()

        return None

    @staticmethod
    def _looks_like_action_question(
        question: str,
    ) -> bool:
        text = question.lower()

        action_phrases = {
            "what should i do",
            "what do i do",
            "what next",
            "next step",
            "next steps",
            "how do i verify",
            "how should i verify",
            "how can i verify",
            "where do i check",
            "show me how",
            "what evidence",
            "what should the auditor verify",
            "what needs review",
        }

        return any(
            phrase in text
            for phrase in action_phrases
        )

    @staticmethod
    def _recent_conversation(
        user_id: str | None,
        limit: int = 3,
    ) -> list[dict[str, str]]:
        """
        Compact conversational memory for follow-up questions such as
        'what should I do next?' or 'show me those transactions?'.
        """
        if not user_id:
            return []

        try:
            rows = (
                supabase
                .table("copilot_history")
                .select(
                    "question, answer, intent, created_at"
                )
                .eq(
                    "user_id",
                    user_id,
                )
                .order(
                    "created_at",
                    desc=True,
                )
                .limit(
                    max(
                        1,
                        min(
                            limit,
                            5,
                        ),
                    )
                )
                .execute()
                .data
                or []
            )

            rows = list(
                reversed(
                    cast(
                        list[
                            dict[
                                str,
                                Any,
                            ]
                        ],
                        rows,
                    )
                )
            )

            return [
                {
                    "question": (
                        str(
                            item.get(
                                "question"
                            )
                            or ""
                        )[:500]
                    ),
                    "answer": (
                        str(
                            item.get(
                                "answer"
                            )
                            or ""
                        )[:900]
                    ),
                    "intent": (
                        str(
                            item.get(
                                "intent"
                            )
                            or ""
                        )
                    ),
                }
                for item in rows
            ]

        except Exception:
            return []

    @staticmethod
    def _build_actions(
        intent: str,
        client_id: str | None,
        dataset_id: str | None,
        transaction_id: str | None,
        findings_summary_context: dict[str, Any],
        network_context: dict[str, Any],
    ) -> list[dict[str, str]]:
        """
        Generic product-navigation layer.

        Actions are generated from the resolved audit context and intent,
        not from one hard-coded user question.
        """
        actions: list[
            dict[
                str,
                str,
            ]
        ] = []

        def add(
            label: str,
            route: str,
            description: str,
        ) -> None:
            if not any(
                item[
                    "route"
                ]
                == route
                for item in actions
            ):
                actions.append(
                    {
                        "label": label,
                        "route": route,
                        "description": description,
                    }
                )

        query_parts: list[str] = []

        if client_id:
            query_parts.append(
                f"clientId={client_id}"
            )

        if dataset_id:
            query_parts.append(
                f"datasetId={dataset_id}"
            )

        current_analysis_id = None

        ids = (
            findings_summary_context
            .get(
                "current_analysis_ids"
            )
            or []
        )

        if (
            dataset_id
            and len(
                ids
            )
            == 1
        ):
            current_analysis_id = str(
                ids[
                    0
                ]
            )

        if (
            not current_analysis_id
            and dataset_id
            and network_context
        ):
            results = (
                network_context.get(
                    "network_results"
                )
                or []
            )

            if len(
                results
            ) == 1:
                current_analysis_id = str(
                    results[
                        0
                    ].get(
                        "current_analysis_id"
                    )
                    or ""
                )

        if current_analysis_id:
            query_parts.append(
                f"analysisId={current_analysis_id}"
            )

        query = (
            "?"
            + "&".join(
                query_parts
            )
            if query_parts
            else ""
        )

        if intent in {
            "finding_explanation",
            "priority_findings",
            "client_summary",
            "dataset_summary",
            "audit_observation",
            "management_summary",
            "audit_procedures",
        }:
            add(
                "Open Findings",
                f"/investigation{query}",
                (
                    "Review the current transaction findings, reasons and supporting evidence."
                ),
            )

        if intent in {
            "vendor_relationship",
        }:
            network_query = (
                f"?datasetId={dataset_id}"
                if dataset_id
                else (
                    f"?clientId={client_id}"
                    if client_id
                    else ""
                )
            )

            add(
                "Open Network Analysis",
                f"/network{network_query}",
                (
                    "Inspect connected vendors, shared identifiers and suspicious relationship clusters."
                ),
            )

        if intent in {
            "audit_procedures",
            "finding_explanation",
            "priority_findings",
            "audit_observation",
        }:
            add(
                "Review Audit Checks",
                (
                    f"/rules?clientId={client_id}"
                    if client_id
                    else "/rules"
                ),
                (
                    "Review the audit checks and thresholds relevant to the current client."
                ),
            )

        if intent in {
            "client_summary",
            "dataset_summary",
            "management_summary",
            "audit_observation",
            "priority_findings",
            "finding_explanation",
        }:
            report_query = []

            if client_id:
                report_query.append(
                    f"clientId={client_id}"
                )

            if dataset_id:
                report_query.append(
                    f"datasetId={dataset_id}"
                )

            report_suffix = (
                "?"
                + "&".join(
                    report_query
                )
                if report_query
                else ""
            )

            add(
                "Generate Report",
                f"/reports{report_suffix}",
                (
                    "Prepare the current audit results in the internal-audit report workflow."
                ),
            )

        if intent in {
            "portfolio_summary",
        }:
            add(
                "Open Dashboard",
                "/dashboard",
                (
                    "Review the current portfolio-level audit position and priority findings."
                ),
            )

        if (
            dataset_id
            and intent
            in {
                "dataset_summary",
                "audit_procedures",
            }
        ):
            add(
                "View Dataset",
                f"/datasets?datasetId={dataset_id}",
                (
                    "Review dataset details before performing additional audit procedures."
                ),
            )

        return actions[:4]

    @staticmethod
    def _application_page_reference() -> str:
        lines = []

        for name, details in (
            CopilotService
            .APPLICATION_PAGES
            .items()
        ):
            lines.append(
                f"- {name} ({details['route']}): {details['purpose']}"
            )

        return "\n".join(lines)

    @staticmethod
    def _create_plan(
        question: str,
        client_id: str | None,
        dataset_id: str | None,
        transaction_id: str | None,
    ) -> dict[str, Any]:
        fallback = CopilotService._fallback_plan(
            question,
            client_id,
            dataset_id,
            transaction_id,
        )

        prompt = f"""
You are the planning agent for an internal-audit AI Copilot.

Allowed intents:
portfolio_summary
client_summary
dataset_summary
finding_explanation
priority_findings
audit_procedures
vendor_relationship
audit_observation
management_summary
general_audit_guidance

Available tools:
LIVE_AUDIT_DATA = current clients, datasets, latest completed assessments and a small set of priority transactions when needed.
FINDINGS_SUMMARY = complete current findings aggregation for a client/dataset, including exact risk counts, total findings, top audit observations and priority transactions.
NETWORK_ANALYSIS = the actual vendor/entity graph-analysis result used by the Network Analytics page.
AUDIT_KNOWLEDGE = semantic retrieval from internal audit guidance.

Selections:
client selected = {bool(client_id)}
dataset selected = {bool(dataset_id)}
transaction selected = {bool(transaction_id)}

Question:
{question}

Return ONLY valid JSON:
{{
  "intent": "one allowed intent",
  "use_live_data": true,
  "include_findings": true,
  "use_findings_summary": false,
  "use_network_data": false,
  "use_rag": true
}}

Rules:
- Questions asking for findings, audit observations, risk distribution, finding counts, or "what are the findings for <client/dataset>" MUST use FINDINGS_SUMMARY.
- Questions about network analysis, vendor relationships, connected vendors, shared GST/PAN/bank/phone/email/address, clusters, graph, linked entities, or network findings MUST use NETWORK_ANALYSIS.
- Never infer client-wide or network-wide results from a small transaction subset.
- Actual client/dataset/transaction questions need LIVE_AUDIT_DATA.
- Specific transaction explanations need LIVE_AUDIT_DATA and findings.
- Audit procedures, recommendations and guidance should use AUDIT_KNOWLEDGE.
- Never request historical analysis runs.
"""

        try:
            completion = (
                CopilotService._client()
                .chat.completions.create(
                    model=CopilotService.MODEL,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "Return JSON only. Do not add markdown."
                            ),
                        },
                        {
                            "role": "user",
                            "content": prompt,
                        },
                    ],
                    temperature=0,
                    max_tokens=240,
                )
            )

            text = (
                completion.choices[0].message.content
                or ""
            ).strip()

            parsed = json.loads(
                CopilotService._extract_json(text)
            )

            allowed = {
                "portfolio_summary",
                "client_summary",
                "dataset_summary",
                "finding_explanation",
                "priority_findings",
                "audit_procedures",
                "vendor_relationship",
                "audit_observation",
                "management_summary",
                "general_audit_guidance",
            }

            intent = str(
                parsed.get("intent")
                or fallback["intent"]
            )

            if intent not in allowed:
                intent = fallback["intent"]

            use_findings_summary = bool(
                parsed.get(
                    "use_findings_summary",
                    fallback["use_findings_summary"],
                )
            )

            use_network_data = bool(
                parsed.get(
                    "use_network_data",
                    fallback["use_network_data"],
                )
            )

            # Hard safety override: network vocabulary always invokes
            # the dedicated network tool even if planner JSON is imperfect.
            if CopilotService._looks_like_network_question(question):
                intent = "vendor_relationship"
                use_network_data = True

            comparison_terms = {
                "compare",
                "also associated",
                "overlap",
                "both findings and network",
                "findings with the network",
            }

            if any(
                term in question.lower()
                for term in comparison_terms
            ):
                use_network_data = True
                use_findings_summary = True
                use_live_data = True

            if CopilotService._looks_like_findings_summary_question(
                question
            ):
                if intent not in {
                    "finding_explanation",
                    "vendor_relationship",
                }:
                    intent = (
                        "client_summary"
                        if client_id
                        else (
                            "dataset_summary"
                            if dataset_id
                            else "priority_findings"
                        )
                    )

                use_findings_summary = True

            use_live_data = bool(
                parsed.get(
                    "use_live_data",
                    fallback["use_live_data"],
                )
            )

            include_findings = bool(
                parsed.get(
                    "include_findings",
                    fallback["include_findings"],
                )
            )

            comparison_terms = {
                "compare",
                "also associated",
                "overlap",
                "both findings and network",
                "findings with the network",
            }

            if any(
                term in question.lower()
                for term in comparison_terms
            ):
                use_network_data = True
                use_findings_summary = True
                use_live_data = True

            return {
                "intent": intent,
                "use_live_data": use_live_data,
                "include_findings": include_findings,
                "use_findings_summary": use_findings_summary,
                "use_network_data": use_network_data,
                "use_rag": bool(
                    parsed.get(
                        "use_rag",
                        fallback["use_rag"],
                    )
                ),
            }

        except Exception:
            return fallback

    @staticmethod
    def _fallback_plan(
        question: str,
        client_id: str | None,
        dataset_id: str | None,
        transaction_id: str | None,
    ) -> dict[str, Any]:
        text = question.lower()

        use_network = CopilotService._looks_like_network_question(
            question
        )

        use_findings_summary = (
            CopilotService
            ._looks_like_findings_summary_question(
                question
            )
        )

        use_rag = any(
            word in text
            for word in {
                "procedure",
                "verify",
                "recommend",
                "guidance",
                "control",
                "evidence",
                "what next",
            }
        )

        include_findings = (
            bool(transaction_id)
            or any(
                word in text
                for word in {
                    "transaction",
                    "finding",
                    "risk",
                    "suspicious",
                    "priority",
                    "why",
                }
            )
        )

        use_live = (
            bool(
                client_id
                or dataset_id
                or transaction_id
            )
            or include_findings
            or "summary" in text
        )

        if use_network:
            intent = "vendor_relationship"
            use_live = True
            include_findings = False

        elif use_findings_summary:
            intent = (
                "client_summary"
                if client_id
                else (
                    "dataset_summary"
                    if dataset_id
                    else "priority_findings"
                )
            )
            use_live = True
            include_findings = False

        elif transaction_id:
            intent = "finding_explanation"

        elif (
            "procedure" in text
            or "verify" in text
            or "what next" in text
        ):
            intent = "audit_procedures"

        elif dataset_id:
            intent = "dataset_summary"

        elif client_id:
            intent = "client_summary"

        elif use_live:
            intent = "portfolio_summary"

        else:
            intent = "general_audit_guidance"
            use_rag = True

        return {
            "intent": intent,
            "use_live_data": use_live,
            "include_findings": include_findings,
            "use_findings_summary": use_findings_summary,
            "use_network_data": use_network,
            "use_rag": use_rag,
        }


    @staticmethod
    def _looks_like_findings_summary_question(
        question: str,
    ) -> bool:
        text = question.lower()

        summary_terms = {
            "what are the findings",
            "findings for",
            "findings of",
            "show findings",
            "summarize findings",
            "summarise findings",
            "audit findings",
            "risk distribution",
            "finding count",
            "findings count",
            "what did you find",
            "what was found",
            "audit observations",
            "observations for",
            "audit checks",
            "triggered most often",
            "most frequently triggered",
            "most common checks",
            "major checks",
            "finding distribution",
        }

        return any(
            term in text
            for term in summary_terms
        )

    @staticmethod
    def _looks_like_network_question(
        question: str,
    ) -> bool:
        text = question.lower()

        network_terms = {
            "network",
            "vendor relationship",
            "vendor relationships",
            "connected vendor",
            "connected vendors",
            "shared identifier",
            "shared identifiers",
            "shared gst",
            "shared pan",
            "shared bank",
            "bank account shared",
            "cluster",
            "clusters",
            "linked vendor",
            "linked vendors",
            "graph",
            "relationship analysis",
            "relationship results",
        }

        return any(
            term in text
            for term in network_terms
        )

    @staticmethod
    def _compact_live_context(
        live_context: dict[str, Any],
    ) -> dict[str, Any]:
        if not live_context:
            return {}

        return {
            "current_scope": live_context.get("current_scope") or {},
            "clients": [
                {
                    "client_name": item.get("client_name"),
                    "client_code": item.get("client_code"),
                    "industry": item.get("industry"),
                }
                for item in (
                    live_context.get("clients")
                    or []
                )[:5]
            ],
            "datasets": [
                {
                    "dataset_name": item.get("dataset_name"),
                    "total_records": item.get("total_records"),
                }
                for item in (
                    live_context.get("datasets")
                    or []
                )[:5]
            ],
            "current_analyses": (
                live_context.get("current_analyses")
                or []
            )[:5],
            "summary": live_context.get("summary") or {},
            "priority_transaction_examples": [
                {
                    "transaction_id": item.get("transaction_id"),
                    "risk_level": item.get("risk_level"),
                    "risk_score": item.get("risk_score"),
                    "reasons": (
                        item.get("reasons") or []
                    )[:4],
                    "triggered_audit_checks": (
                        item.get("triggered_audit_checks")
                        or []
                    )[:4],
                }
                for item in (
                    live_context.get("findings")
                    or []
                )[:12]
            ]
        }

    @staticmethod
    def _response_mode(
        question: str,
        intent: str,
    ) -> str:
        text = question.lower()

        if CopilotService._looks_like_action_question(
            question
        ):
            return "procedural"

        if (
            "management" in text
            or "executive" in text
        ):
            return "management_summary"

        if (
            "compare" in text
            or "also associated" in text
            or "overlap" in text
        ):
            return "comparison"

        if intent == "vendor_relationship":
            return "network_summary"

        if intent == "finding_explanation":
            return "finding_explanation"

        if intent == "priority_findings":
            return "prioritisation"

        if intent in {
            "client_summary",
            "dataset_summary",
        }:
            return "findings_summary"

        if intent == "audit_procedures":
            return "procedural"

        return "direct_answer"

    @staticmethod
    def _sanitize_answer(
        answer: str,
    ) -> str:
        """
        Final guard against leaking implementation/RAG terminology.
        """
        replacements = {
            "CURRENT AUDIT DATA": "current audit information",
            "FINDINGS SUMMARY": "current findings",
            "NETWORK ANALYSIS DATA": "network analysis",
            "RETRIEVED AUDIT KNOWLEDGE": "audit guidance",
            "priority_transaction_examples": "priority transactions",
            "priority findings sample": "priority transactions",
            "sample warning": "",
            "full findings population": "current findings",
            "provided context": "available audit information",
            "context window": "available information",
            "retrieval limit": "",
        }

        cleaned = answer

        for old, new in replacements.items():
            cleaned = re.sub(
                re.escape(old),
                new,
                cleaned,
                flags=re.IGNORECASE,
            )

        cleaned = re.sub(
            r"\s{3,}",
            "  ",
            cleaned,
        )

        return cleaned.strip()

    @staticmethod
    def _generate_answer(
        question: str,
        plan: dict[str, Any],
        live_context: dict[str, Any],
        network_context: dict[str, Any],
        findings_summary_context: dict[str, Any],
        knowledge: list[dict[str, Any]],
        user_role: str | None,
        recent_conversation: list[dict[str, str]],
    ) -> str:
        response_mode = CopilotService._response_mode(
            question=question,
            intent=str(plan.get("intent") or ""),
        )

        compact_live = CopilotService._compact_live_context(
            live_context
        )

        live_json = json.dumps(
            compact_live,
            ensure_ascii=False,
            default=str,
            separators=(",", ":"),
        )

        network_json = json.dumps(
            network_context,
            ensure_ascii=False,
            default=str,
            separators=(",", ":"),
        )

        findings_summary_json = json.dumps(
            findings_summary_context,
            ensure_ascii=False,
            default=str,
            separators=(",", ":"),
        )

        conversation_json = json.dumps(
            recent_conversation,
            ensure_ascii=False,
            default=str,
            separators=(",", ":"),
        )

        knowledge_text = "\n\n".join(
            (
                f"[Knowledge source: {item.get('source') or 'audit guidance'}]\n"
                f"{str(item.get('text') or '')[:650]}"
            )
            for item in knowledge[:3]
        )

        system_prompt = """
You are AuditRisk AI Copilot for auditors and audit managers.

Grounding rules:
- Current Supabase/application data is authoritative for client, dataset, assessment and finding facts.
- NETWORK ANALYSIS DATA is authoritative for vendor/entity relationship questions.
- Use FINDINGS SUMMARY as the authority for client/dataset-wide finding counts, risk distribution and audit observations.
- Small transaction examples in CURRENT AUDIT DATA are examples only and must never be used for whole-client or whole-dataset absence claims.
- Use only the latest completed assessment context.
- Never combine or average historical runs.
- Never invent transaction IDs, vendors, counts, clusters, relationships, rules or findings.
- If a dataset is selected, answer only for that selected dataset unless the user explicitly asks for a wider scope.
- If a client is selected/resolved, do not silently mix another client's data into the answer.
- Frequency is NOT severity. A frequently triggered audit check is common, not automatically High risk.
- Risk severity must come only from the application's actual risk classifications/scores.

Communication rules:
- Use business/audit language.
- Never expose implementation language such as "sample", "sample warning", "prompt", "context window", "retrieval limit", "provided context", "full findings population", "tool", section labels, JSON keys, or internal database field names unless the user explicitly asks for technical implementation details.
- Never mention CURRENT AUDIT DATA, FINDINGS SUMMARY, NETWORK ANALYSIS DATA, priority_transaction_examples, or similar internal context labels in the user-facing answer.
- Do not say "the provided data does not contain..." when a purpose-specific current audit summary has been retrieved. State the actual business result directly.
- Prefer phrases such as vendor relationship indicator, shared identifier, connected vendor group, audit observation and transaction requiring review.
- A relationship indicator or flagged transaction is not proof of fraud.
- If network analysis is unsupported because relationship columns are absent, state that clearly.
- If network analysis was not requested/provided, do not make claims about its results.
- Do not provide a statutory audit opinion or legal conclusion.
- When the user asks "what should I do?", "what next?", "how do I verify this?", "where do I check?", "show me how", or otherwise asks for an action, answer as an in-product workflow:
  1. state the immediate audit objective,
  2. give numbered practical steps,
  3. tell the user which exact AuditRisk AI page from AVAILABLE APPLICATION PAGES to open when a relevant page exists,
  4. specify what to inspect on that existing page,
  5. state what external/source evidence must still be obtained outside the platform.
- Never pretend the platform contains invoices, contracts, bank statements, approvals or other source documents unless they were actually uploaded and available.
- Distinguish clearly between actions available inside AuditRisk AI and evidence the auditor must obtain from the client's records.
- For follow-up questions, use RECENT CONVERSATION only to understand the referent. Current application data remains the authority for facts.
- NEVER invent an application page, button, tab, field, feature or workflow.
- You may mention an AuditRisk AI page ONLY if it appears in AVAILABLE APPLICATION PAGES below.
- There is NO "Transaction Details" page. Transaction-level review is performed on the Findings page (/investigation).
- If a requested operation has no page in the application, say it must be performed outside AuditRisk AI rather than inventing a page.
- When giving navigation instructions, use the exact page names from AVAILABLE APPLICATION PAGES.
- Do not claim that AuditRisk AI stores invoices, contracts, bank statements, purchase orders or management explanations unless the current application data explicitly shows that such evidence was uploaded.

Response-style rules:
- RESPONSE MODE = direct_answer: answer only the question; do not append a generic audit workflow.
- RESPONSE MODE = findings_summary: give exact counts, main observations and concise priority items. Do not add a long procedure unless asked.
- RESPONSE MODE = finding_explanation: explain what was observed, why it matters and what to verify next. If the exact transaction is not present in current findings, say so plainly without referring to internal retrieval/context mechanics.
- RESPONSE MODE = prioritisation: rank the current transactions by actual risk severity/score and explain why.
- RESPONSE MODE = network_summary: summarize the selected scope's actual network result. Do not append a generic transaction-evidence checklist unless the user asks how to investigate.
- RESPONSE MODE = management_summary: business-focused, concise, no technical engine language, and only brief management actions.
- RESPONSE MODE = comparison: directly compare the two evidence sources and identify actual overlaps only.
- RESPONSE MODE = procedural: provide numbered steps, real AuditRisk AI page navigation, and clearly separate in-platform actions from external client evidence.

For audit-check questions:
- use exact trigger counts from current findings,
- explain each major check separately,
- give check-specific verification procedures,
- do not convert trigger frequency into risk severity.

For network-analysis questions:
1. state the selected scope clearly,
2. report actual suspicious clusters/shared identifiers,
3. identify strongest connected vendors or affected transactions if available,
4. include only concise review implications unless detailed procedures were requested.

If the actual network result contains zero suspicious clusters/identifiers/findings, say that the network analysis did not identify shared-relationship indicators in the selected current scope.
"""

        user_prompt = f"""
User role: {user_role or 'Audit User'}
Agent intent: {plan.get('intent')}
Response mode: {response_mode}

The following evidence sections are internal grounding only. Never name or quote their section labels in the answer.

QUESTION
{question}

RECENT CONVERSATION
{conversation_json if recent_conversation else 'No prior conversation is needed.'}

AVAILABLE APPLICATION PAGES
{CopilotService._application_page_reference()}

CURRENT AUDIT DATA
{live_json if compact_live else 'Not requested.'}

FINDINGS SUMMARY
{findings_summary_json if findings_summary_context else 'Not requested.'}

NETWORK ANALYSIS DATA
{network_json if network_context else 'Not requested.'}

RETRIEVED AUDIT KNOWLEDGE
{knowledge_text if knowledge_text else 'Not requested.'}

Answer only from the relevant grounded evidence above.
"""

        completion = (
            CopilotService._client()
            .chat.completions.create(
                model=CopilotService.MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
                temperature=0.1,
                max_tokens=850,
            )
        )

        answer = (
            completion.choices[0].message.content
            or ""
        ).strip()

        if not answer:
            raise HTTPException(
                status_code=502,
                detail="Groq returned an empty Copilot response.",
            )

        return CopilotService._sanitize_answer(
            answer
        )

    @staticmethod
    def _build_sources(
        live_context: dict[str, Any],
        network_context: dict[str, Any],
        findings_summary_context: dict[str, Any],
        knowledge: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        sources: list[dict[str, Any]] = []

        for analysis in (
            live_context.get("current_analyses")
            or []
        ):
            sources.append(
                {
                    "type": "current_assessment",
                    "analysis_id": analysis.get("analysis_id"),
                    "dataset_id": analysis.get("dataset_id"),
                    "completed_at": analysis.get("completed_at"),
                }
            )


        if findings_summary_context:
            scope = (
                findings_summary_context.get(
                    "scope"
                )
                or {}
            )

            sources.append(
                {
                    "type": (
                        "current_findings_summary"
                    ),
                    "client_id": (
                        scope.get(
                            "client_id"
                        )
                    ),
                    "dataset_id": (
                        scope.get(
                            "dataset_id"
                        )
                    ),
                    "current_assessments": (
                        findings_summary_context.get(
                            "current_assessments"
                        )
                    ),
                }
            )

        for result in (
            network_context.get("network_results")
            or []
        ):
            sources.append(
                {
                    "type": "network_analysis",
                    "dataset_id": result.get("dataset_id"),
                    "dataset_name": result.get("dataset_name"),
                    "analysis_id": result.get("current_analysis_id"),
                }
            )

        for item in knowledge:
            sources.append(
                {
                    "type": "audit_knowledge",
                    "source": (
                        item.get("source")
                        or "audit guidance"
                    ),
                }
            )

        unique: list[dict[str, Any]] = []
        seen: set[str] = set()

        for item in sources:
            key = json.dumps(
                item,
                sort_keys=True,
                default=str,
            )

            if key in seen:
                continue

            seen.add(key)
            unique.append(item)

        return unique

    @staticmethod
    def _single_current_analysis_id(
        live_context: dict[str, Any],
    ) -> str | None:
        analyses = (
            live_context.get("current_analyses")
            or []
        )

        if len(analyses) != 1:
            return None

        value = analyses[0].get("analysis_id")

        return str(value) if value else None

    @staticmethod
    def _save_history(
        user_id: str | None,
        client_id: str | None,
        dataset_id: str | None,
        analysis_id: str | None,
        question: str,
        answer: str,
        intent: str,
        sources: list[dict[str, Any]],
    ) -> None:
        try:
            (
                supabase.table("copilot_history")
                .insert(
                    {
                        "user_id": user_id,
                        "client_id": client_id,
                        "dataset_id": dataset_id,
                        "analysis_id": analysis_id,
                        "question": question,
                        "answer": answer,
                        "intent": intent,
                        "sources": sources,
                    }
                )
                .execute()
            )

        except Exception as exc:
            print(
                "Copilot history save failed:",
                exc,
            )

    @staticmethod
    def get_history(
        user_id: str | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        query = (
            supabase.table("copilot_history")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
        )

        if user_id:
            query = query.eq(
                "user_id",
                user_id,
            )

        return cast(
            list[dict[str, Any]],
            query.execute().data or [],
        )

    @staticmethod
    def _extract_json(
        text: str,
    ) -> str:
        stripped = text.strip()

        if stripped.startswith("```"):
            stripped = (
                stripped
                .replace("```json", "", 1)
                .replace("```", "")
                .strip()
            )

        start = stripped.find("{")
        end = stripped.rfind("}")

        if start >= 0 and end > start:
            return stripped[start:end + 1]

        return stripped
