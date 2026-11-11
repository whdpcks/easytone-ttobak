"""
또박 FastAPI 백엔드 — D 개발용 앱
팀 공통 앱 연결(A), 업로드(B), 분석 결과·상태 라우터(C)는 A가 연결합니다.
C의 라우터가 GET /documents/{id}, GET /documents/{id}/status 를 제공합니다.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import documents, search

app = FastAPI(title="또박 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# D 담당 라우터
app.include_router(documents.router)
app.include_router(search.router)

@app.get("/health")
def health():
    return {"status": "ok"}
