from fastapi import FastAPI

app = FastAPI(
    title="AI Audit Risk Analysis Platform",
    version="1.0.0",
    description="Enterprise Audit Risk Analytics Platform"
)


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