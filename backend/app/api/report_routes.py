from io import BytesIO

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.services.report_service import ReportService


router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)


@router.get("/context")
def get_report_context():
    return ReportService.get_context()


@router.get("/preview")
def preview_report(
    report_type: str = Query(...),
    client_id: str | None = Query(default=None),
    dataset_id: str | None = Query(default=None),
    analysis_id: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    detection_source: str | None = Query(default=None),
):
    return ReportService.build_report(
        report_type=report_type,
        client_id=client_id,
        dataset_id=dataset_id,
        analysis_id=analysis_id,
        risk_level=risk_level,
        detection_source=detection_source,
    )


@router.get("/export/{export_format}")
def export_report(
    export_format: str,
    report_type: str = Query(...),
    client_id: str | None = Query(default=None),
    dataset_id: str | None = Query(default=None),
    analysis_id: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    detection_source: str | None = Query(default=None),
):
    report = ReportService.build_report(
        report_type=report_type,
        client_id=client_id,
        dataset_id=dataset_id,
        analysis_id=analysis_id,
        risk_level=risk_level,
        detection_source=detection_source,
    )

    content, media_type, filename = (
        ReportService.export_report(
            report,
            export_format,
        )
    )

    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )
