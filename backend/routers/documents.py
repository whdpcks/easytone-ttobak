"""
D 담당 — GET /documents?category=  &  GET /documents/{id}
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Document
import json

router = APIRouter(prefix="/documents", tags=["documents"])


def doc_to_dict(doc: Document) -> dict:
    base = {
        "id":         doc.id,
        "title":      doc.title,
        "sender":     doc.sender,
        "category":   doc.category,
        "status":     doc.status,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }
    # C가 저장한 분석 결과 필드를 그대로 합침
    base.update(doc.fields_dict)
    return base


@router.get("")
def list_documents(category: str | None = None, db: Session = Depends(get_db)):
    """보관함 목록 — 최신순, 카테고리 필터 선택"""
    q = db.query(Document).filter(Document.status == "done")
    if category:
        q = q.filter(Document.category == category)
    docs = q.order_by(Document.created_at.desc()).all()
    return [doc_to_dict(d) for d in docs]


@router.get("/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db)):
    """문서 단건 조회 — 상세 화면용"""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc_to_dict(doc)
