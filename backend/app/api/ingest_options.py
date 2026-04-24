from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..infra.parsing.registry import ParserRegistry

router = APIRouter()


@router.get("/api/ingest/options")
def get_ingest_options() -> dict:
    try:
        options_path = Path(__file__).resolve().parents[1] / "config" / "ingest_options.yaml"
        reg = ParserRegistry(options_path=options_path)
        return reg.options()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

