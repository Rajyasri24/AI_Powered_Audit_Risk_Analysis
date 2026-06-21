from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


from app.api.dataset_routes import router as dataset_router
from app.api.client_routes import router as client_router
from app.api.rule_routes import router as rule_router
from app.api.client_rule_routes import router as client_rule_router
from app.api.analysis_routes import router as analysis_router
from app.api.finding_routes import router as finding_router

app = FastAPI(
    title="AI Audit Risk Analysis Platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dataset_router)
app.include_router(client_router)
app.include_router(rule_router)
app.include_router(client_rule_router)
app.include_router(analysis_router)
app.include_router(finding_router)


@app.get("/")
def root():
    return {"message": "Backend Running"}