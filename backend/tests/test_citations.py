from llama_index.core.schema import NodeWithScore, TextNode


def test_build_citations_enriches_title_and_truncates_snippet():
    from backend.app.services.citations import build_citations  # noqa: PLC0415

    node = TextNode(
        id_="chunk-1",
        text="A" * 1000,
        metadata={"kb_id": "kb1", "doc_id": "doc1", "chunk_index": 3},
    )
    nws = NodeWithScore(node=node, score=0.42)

    citations = build_citations(
        [nws],
        doc_meta_by_id={"doc1": {"title": "Doc Title", "source": "file.pdf"}},
        snippet_max_len=120,
    )
    assert len(citations) == 1
    c = citations[0]
    assert c["kb_id"] == "kb1"
    assert c["doc_id"] == "doc1"
    assert c["chunk_id"] == "chunk-1"
    assert c["chunk_index"] == 3
    assert c["title"] == "Doc Title"
    assert c["source"] == "file.pdf"
    assert c["score"] == 0.42
    assert len(c["snippet"]) <= 120
    assert c["snippet"].endswith("…")

