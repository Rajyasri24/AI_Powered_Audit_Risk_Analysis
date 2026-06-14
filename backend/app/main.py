from fastapi import FastAPI
from app.api.client_routes import router as client_router
from app.api.rule_routes import router as rule_router
app = FastAPI(
    title="AI Audit Risk Analysis Platform",
    version="1.0.0",
    description="Enterprise Audit Risk Analytics Platform"
)

app.include_router(client_router)
app.include_router(rule_router)
@app.get("/")
def health_check():
    return {
        "status": "running",
        "project": "AI Audit Risk Analysis Platform",
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    return {
        "healthy": True
    }