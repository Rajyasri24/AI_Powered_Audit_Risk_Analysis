from __future__ import annotations

from pathlib import Path
from typing import Any

import chromadb

BASE_DIR = Path(__file__).resolve().parents[2]
CHROMA_DIR = BASE_DIR / "chroma_db"
KNOWLEDGE_DIR = BASE_DIR / "knowledge" / "audit_guidance"


class RAGService:
    COLLECTION_NAME = "audit_guidance"

    @staticmethod
    def _collection():
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)

        client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        collection = client.get_or_create_collection(
            name=RAGService.COLLECTION_NAME,
            metadata={
                "description": "Internal audit guidance for AuditRisk AI Copilot"
            },
        )
        RAGService._ensure_seeded(collection)
        return collection

    @staticmethod
    def _ensure_seeded(collection) -> None:
        ids: list[str] = []
        documents: list[str] = []
        metadatas: list[dict[str, str]] = []

        for path in sorted(KNOWLEDGE_DIR.glob("*")):
            if not path.is_file() or path.suffix.lower() not in {".txt", ".md"}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore").strip()
            if not text:
                continue
            for index, chunk in enumerate(RAGService._chunk_text(text)):
                ids.append(f"{path.stem}-{index}")
                documents.append(chunk)
                metadatas.append({"source": path.name, "type": "audit_guidance"})

        if documents:
            collection.upsert(ids=ids, documents=documents, metadatas=metadatas)

    @staticmethod
    def search(query: str, limit: int = 4) -> list[dict[str, Any]]:
        collection = RAGService._collection()
        count = collection.count()
        if count == 0:
            return []

        result = collection.query(
            query_texts=[query],
            n_results=min(max(limit, 1), count),
        )

        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]

        items: list[dict[str, Any]] = []
        for index, document in enumerate(documents):
            metadata = metadatas[index] if index < len(metadatas) else {}
            distance = distances[index] if index < len(distances) else None
            items.append(
                {
                    "text": document,
                    "source": metadata.get("source") if isinstance(metadata, dict) else None,
                    "distance": distance,
                }
            )
        return items

    @staticmethod
    def _chunk_text(text: str, chunk_size: int = 900, overlap: int = 120) -> list[str]:
        normalized = " ".join(text.split())
        if len(normalized) <= chunk_size:
            return [normalized]

        chunks: list[str] = []
        start = 0
        while start < len(normalized):
            end = min(start + chunk_size, len(normalized))
            chunks.append(normalized[start:end])
            if end == len(normalized):
                break
            start = max(end - overlap, start + 1)
        return chunks
