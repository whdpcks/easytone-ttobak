"""
또박 FastAPI 백엔드 — main.py
A/B/C/D 담당 라우터를 모두 여기에 등록
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base

# 모델 임포트 (테이블 생성용)
import models  # noqa

# 라우터 임포트
from routers import documents, search
# from routers import auth, pages  # A 담당
# from routers import upload       # B 담당
# from routers import analyze      # C 담당

Base.metadata.create_all(bind=engine)

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
