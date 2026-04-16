from __future__ import annotations

from typing import Any, Mapping, Sequence

from llama_index.core.schema import NodeWithScore


def _truncate_snippet(text: str, *, max_len: int) -> str:
    collapsed = " ".join((text or "").split())
    if max_len <= 0:
        return ""
    if len(collapsed) <= max_len:
        return collapsed
    if max_len == 1:
        return "…"
    return collapsed[: max_len - 1] + "…"


def build_citations(
    nodes: Sequence[NodeWithScore],
    *,
    doc_meta_by_id: Mapping[str, Mapping[str, Any]] | None = None,
    snippet_max_len: int = 320,
) -> list[dict[str, Any]]:
    """
    Convert retrieved nodes into a JSON-serializable citations array.

    Shape is intentionally frontend-oriented (title/source/snippet).
    """
    meta_map = doc_meta_by_id or {}
    out: list[dict[str, Any]] = []

    for nws in nodes:
        node = nws.node
        meta = node.metadata or {}
        kb_id = meta.get("kb_id")
        doc_id = meta.get("doc_id")
        chunk_index = meta.get("chunk_index")

        doc_meta = meta_map.get(str(doc_id)) if doc_id is not None else None
        title = doc_meta.get("title") if isinstance(doc_meta, Mapping) else None
        source = doc_meta.get("source") if isinstance(doc_meta, Mapping) else None

        out.append(
            {
                "kb_id": str(kb_id or ""),
                "doc_id": str(doc_id or ""),
                "chunk_id": str(getattr(node, "id_", "") or ""),
                **(
                    {"chunk_index": int(chunk_index)}
                    if isinstance(chunk_index, (int, float))
                    else {}
                ),
                **({"title": str(title)} if title else {}),
                **({"source": str(source)} if source else {}),
                **({"score": float(nws.score)} if nws.score is not None else {}),
                "snippet": _truncate_snippet(
                    node.get_content(metadata_mode="none"), max_len=snippet_max_len
                ),
            }
        )

    return out

