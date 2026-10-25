"""
Thin reverse-proxy to the DMAIC Agent API (default: http://localhost:8001).

All /api/dmaic/** requests from the Pulp Pulse frontend are forwarded here.
SSE streams (/runs/{id}/stream) are proxied with chunked pass-through so the
browser can receive real-time phase-completion events without CORS or port
issues.

Set DMAIC_API_URL in the environment to point at a non-default host/port.
"""

import os
import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse, Response

DMAIC_API_URL = os.getenv("DMAIC_API_URL", "http://localhost:8001")

router = APIRouter(prefix="/dmaic", tags=["dmaic-proxy"])


@router.get("/historical-datasets/{module_name}")
def get_historical_dataset(module_name: str):
    """
    Returns calibrated historical baseline and post-intervention datasets,
    metrics, problem statement, and grounded SOP content for the specified
    supply chain module.
    """
    from backend.app.services.dmaic_historical_data import get_module_dmaic_dataset
    return get_module_dmaic_dataset(module_name)


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def dmaic_proxy(path: str, request: Request):
    """
    Transparent proxy to the DMAIC FastAPI service.

    - Regular JSON/form-data requests: buffered pass-through.
    - SSE stream endpoints (path ends with '/stream'): chunked streaming
      pass-through using an async generator so the event-stream stays open.
    """
    target_url = f"{DMAIC_API_URL}/{path}"
    query_params = dict(request.query_params)

    # ------------------------------------------------------------------ #
    # SSE stream pass-through (GET /runs/{id}/stream)                     #
    # ------------------------------------------------------------------ #
    if path.endswith("/stream"):
        async def _sse_generator():
            try:
                async with httpx.AsyncClient(timeout=None) as client:
                    async with client.stream(
                        "GET", target_url, params=query_params
                    ) as upstream:
                        async for chunk in upstream.aiter_bytes():
                            yield chunk
            except httpx.ConnectError:
                yield b'data: {"event":"failed","error":"DMAIC service is not reachable. Start the DMAIC API on port 8001."}\n\n'

        return StreamingResponse(
            _sse_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",  # disable nginx buffering if present
            },
        )

    # ------------------------------------------------------------------ #
    # Normal requests — forward body + headers, return response as-is     #
    # ------------------------------------------------------------------ #
    body = await request.body()

    # Strip hop-by-hop headers that must not be forwarded
    forward_headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length", "transfer-encoding", "connection")
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            upstream = await client.request(
                method=request.method,
                url=target_url,
                content=body,
                headers=forward_headers,
                params=query_params,
            )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=(
                f"DMAIC Agent service is not reachable at {DMAIC_API_URL}. "
                "Start the DMAIC API with: uvicorn api.main:app --port 8001 --reload"
            ),
        )

    # Strip hop-by-hop response headers before returning
    response_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in ("transfer-encoding", "connection", "keep-alive")
    }

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
    )
