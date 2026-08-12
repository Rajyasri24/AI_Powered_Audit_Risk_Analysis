import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.api.analysis_routes import router as analysis_router
from app.api.client_routes import router as client_router
from app.api.client_rule_routes import router as client_rule_router
from app.api.copilot_routes import router as copilot_router
from app.api.dashboard_routes import router as dashboard_router
from app.api.dataset_routes import router as dataset_router
from app.api.finding_routes import router as finding_router
from app.api.network_routes import router as network_router
from app.api.report_routes import router as report_router
from app.api.rule_routes import router as rule_router
from app.core.rbac import enforce_rbac


app = FastAPI(
    title="AI Audit Risk Analysis Platform",
    version="1.0.0",
)


def get_allowed_origins() -> list[str]:
    origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    frontend_url = os.getenv(
        "FRONTEND_URL",
        "",
    ).strip()

    if frontend_url:
        for origin in frontend_url.split(","):
            cleaned_origin = (
                origin
                .strip()
                .rstrip("/")
            )

            if (
                cleaned_origin
                and cleaned_origin
                not in origins
            ):
                origins.append(
                    cleaned_origin
                )

    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


PUBLIC_PATHS = {
    "/",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
}


@app.middleware("http")
async def rbac_middleware(
    request: Request,
    call_next,
):
    path = request.url.path

    if (
        request.method.upper() == "OPTIONS"
        or path in PUBLIC_PATHS
        or path.startswith("/docs/")
        or path.startswith("/redoc/")
    ):
        return await call_next(
            request
        )

    try:
        user = await run_in_threadpool(
            enforce_rbac,
            request,
        )

        request.state.user = user

    except Exception as exc:
        return JSONResponse(
            status_code=getattr(
                exc,
                "status_code",
                500,
            ),
            content={
                "detail": getattr(
                    exc,
                    "detail",
                    "Access verification failed.",
                )
            },
        )

    return await call_next(
        request
    )


app.include_router(client_router)
app.include_router(rule_router)
app.include_router(client_rule_router)
app.include_router(dataset_router)
app.include_router(analysis_router)
app.include_router(finding_router)
app.include_router(network_router)
app.include_router(dashboard_router)
app.include_router(report_router)
app.include_router(copilot_router)


@app.get("/")
def root():
    return {
        "message": (
            "AI Audit Risk Analysis Platform "
            "Backend Running"
        ),
        "network_analytics": "enabled",
        "reports": "enabled",
        "rbac": "enabled",
        "copilot": "enabled",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }