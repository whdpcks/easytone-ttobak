import json
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Document(Base):
    __tablename__ = "documents"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, nullable=True)
    title      = Column(String, nullable=False)
    sender     = Column(String, nullable=True)
    category   = Column(String, nullable=True)
    status     = Column(String, default="done")   # capturing / reading / marking / simplifying / done
    fields     = Column(Text, nullable=True)       # JSON — C의 분석 결과
    created_at = Column(DateTime, server_default=func.now())

    @property
    def fields_dict(self):
        try:
            return json.loads(self.fields) if self.fields else {}
        except Exception:
            return {}
