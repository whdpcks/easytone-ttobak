"""
시연용 샘플 문서 7개 삽입
실행: python seed.py
"""
import json
from database import engine, SessionLocal, Base
import models

Base.metadata.create_all(bind=engine)

SAMPLES = [
    {
        "title": "건강검진 안내문",
        "sender": "국민건강보험공단",
        "category": "병원·건강",
        "status": "done",
        "fields": {
            "summary": [
                "국가 <mark>건강검진</mark>을 받으라는 안내예요.",
                "<mark>11월 20일 목요일 아침 9시</mark>에 병원에 가요.",
                "전날 <mark>밤 9시부터 굶어야</mark> 해요. 물은 괜찮아요."
            ],
            "datetime": {
                "date": "2026-11-20",
                "time": "오전 9시",
                "label": "검진 받는 날",
                "note": "접수는 8시 40분까지 하세요.",
                "check": False
            },
            "place": {
                "name": "한빛내과의원 2층 검진센터",
                "address": "서울 마포구 월드컵로 12",
                "note": "망원역 2번 출구에서 걸어서 5분"
            },
            "items": [
                {"name": "신분증", "detail": "주민등록증이나 외국인등록증"},
                {"name": "이 안내문", "detail": "종이를 그대로 가져가세요"},
                {"name": "드시는 약 이름", "detail": "약 봉투를 사진 찍어 가도 돼요"}
            ],
            "cautions": [
                "전날 <mark>밤 9시부터</mark> 물 말고는 드시지 마세요.",
                "혈압약은 아침에 물 조금과 드셔도 돼요.",
                "<mark>12월 31일</mark>이 지나면 무료로 받을 수 없어요."
            ],
            "contact": {"name": "건강보험공단 고객센터", "phone": "1577-1000"}
        }
    },
    {
        "title": "근로계약서",
        "sender": "(주)한결물류 김포센터",
        "category": "일·직장",
        "status": "done",
        "fields": {
            "summary": [
                "물류센터에서 <mark>6개월 동안</mark> 일하기로 한 약속이에요.",
                "<mark>12월 1일 월요일</mark>부터 출근해요.",
                "시급은 <mark>10,320원</mark>이에요."
            ],
            "datetime": {
                "date": "2026-12-01",
                "time": "오전 8시",
                "label": "첫 출근 날",
                "note": "하루 8시간, 일주일에 5일 일해요.",
                "check": False
            },
            "place": {
                "name": "한결물류 김포센터 B동",
                "address": "경기 김포시 고촌읍 아라육로 55",
                "note": "센터 정문 경비실에서 이름을 말하세요"
            },
            "items": [
                {"name": "신분증", "detail": "외국인은 외국인등록증"},
                {"name": "통장 사본", "detail": "월급 받을 통장"},
                {"name": "보건증", "detail": "없으면 보건소에서 만들 수 있어요"}
            ],
            "cautions": [
                "서명하기 전에 <mark>시급 10,320원</mark>이 맞는지 확인하세요.",
                "그만두려면 <mark>30일 전</mark>에 말해야 해요."
            ],
            "contact": {"name": "인사담당 박지훈", "phone": "031-987-1234"}
        }
    },
    {
        "title": "10월 급여명세서",
        "sender": "(주)한결물류",
        "category": "일·직장",
        "status": "done",
        "fields": {
            "summary": [
                "10월에 일한 <mark>월급 내역</mark>이에요.",
                "통장에 들어오는 돈은 <mark>2,031,450원</mark>이에요.",
                "세금과 보험료 189,550원이 빠졌어요."
            ],
            "datetime": {
                "date": "2026-11-10",
                "time": "",
                "label": "월급 들어오는 날",
                "note": "은행 쉬는 날이면 하루 전에 들어와요.",
                "check": False
            },
            "place": None,
            "items": None,
            "cautions": ["금액이 이상하면 <mark>3년 안에</mark> 회사에 물어볼 수 있어요."],
            "contact": {"name": "급여담당", "phone": "031-987-1200"}
        }
    },
    {
        "title": "전기요금 고지서",
        "sender": "한국전력공사",
        "category": "돈·요금",
        "status": "done",
        "fields": {
            "summary": [
                "10월 <mark>전기요금 38,420원</mark>을 내라는 종이예요.",
                "<mark>11월 25일</mark>까지 내야 해요.",
                "통장 자동이체를 하면 할인돼요."
            ],
            "datetime": {
                "date": "2026-11-25",
                "time": "",
                "label": "요금 내는 마지막 날",
                "note": "편의점이나 은행에서 낼 수 있어요.",
                "check": False
            },
            "place": None,
            "items": [
                {"name": "이 고지서", "detail": "바코드가 있는 종이"},
                {"name": "카드나 현금", "detail": "편의점에서도 돼요"}
            ],
            "cautions": [
                "늦게 내면 <mark>돈을 조금 더</mark> 내야 해요.",
                "두 달 넘게 안 내면 전기가 약해질 수 있어요."
            ],
            "contact": {"name": "한전 고객센터", "phone": "123"}
        }
    },
    {
        "title": "현장체험학습 안내",
        "sender": "망원초등학교 3학년",
        "category": "학교·아이",
        "status": "done",
        "fields": {
            "summary": [
                "3학년 아이들이 <mark>과학관에 가는</mark> 날이에요.",
                "<mark>11월 14일 금요일</mark> 아침 8시 30분까지 학교에 가요.",
                "동의서를 <mark>11월 12일</mark>까지 내야 해요."
            ],
            "datetime": {
                "date": "2026-11-14",
                "time": "오전 8시 30분",
                "label": "체험학습 가는 날",
                "note": "오후 3시에 학교로 돌아와요.",
                "check": False
            },
            "place": {
                "name": "국립과천과학관",
                "address": "경기 과천시 상하벌로 110",
                "note": "학교에서 버스로 함께 가요"
            },
            "items": [
                {"name": "도시락", "detail": "점심 한 끼"},
                {"name": "물", "detail": "물통 하나"},
                {"name": "편한 운동화", "detail": "많이 걸어요"},
                {"name": "동의서", "detail": "11월 12일까지 담임선생님께"}
            ],
            "cautions": [
                "<mark>동의서</mark>를 안 내면 갈 수 없어요.",
                "멀미를 하면 약을 미리 먹여주세요."
            ],
            "contact": {"name": "3학년 2반 담임 이수진", "phone": "02-334-5678"}
        }
    },
    {
        "title": "기초연금 신청 안내",
        "sender": "망원1동 주민센터",
        "category": "나라·복지",
        "status": "done",
        "fields": {
            "summary": [
                "나라에서 매달 주는 <mark>기초연금</mark>을 신청하라는 안내예요.",
                "주민센터에 직접 가서 신청해요.",
                "<mark>12월 19일</mark>까지 신청하면 돼요."
            ],
            "datetime": {
                "date": "2026-12-19",
                "time": "",
                "label": "신청 마감 날",
                "note": "평일 오전 9시부터 오후 6시까지",
                "check": False
            },
            "place": {
                "name": "망원1동 주민센터 1층",
                "address": "서울 마포구 포은로 120",
                "note": "복지 창구에 이 종이를 보여주세요"
            },
            "items": [
                {"name": "신분증", "detail": ""},
                {"name": "통장", "detail": "연금 받을 통장"},
                {"name": "이 안내문", "detail": ""}
            ],
            "cautions": ["자녀가 대신 가면 <mark>위임장</mark>이 필요해요."],
            "contact": {"name": "주민센터 복지팀", "phone": "02-3153-6600"}
        }
    },
    {
        "title": "체류기간 연장 안내",
        "sender": "서울남부출입국·외국인사무소",
        "category": "비자·체류",
        "status": "done",
        "fields": {
            "summary": [
                "한국에 사는 기간을 <mark>늘리는 신청</mark>을 하라는 안내예요.",
                "지금 체류기간은 <mark>12월 31일</mark>에 끝나요.",
                "인터넷 예약 후 사무소에 가요."
            ],
            "datetime": {
                "date": "2026-12-31",
                "time": "",
                "label": "체류기간 끝나는 날",
                "note": "끝나기 4개월 전부터 신청할 수 있어요.",
                "check": False
            },
            "place": {
                "name": "서울남부출입국·외국인사무소",
                "address": "서울 양천구 목동동로 151",
                "note": "방문 예약 필수"
            },
            "items": [
                {"name": "여권", "detail": ""},
                {"name": "외국인등록증", "detail": ""},
                {"name": "사진 1장", "detail": "6개월 안에 찍은 것"},
                {"name": "혼인관계증명서", "detail": "결혼이민의 경우"}
            ],
            "cautions": [
                "날짜를 넘기면 <mark>벌금</mark>을 낼 수 있어요.",
                "방문 전에 <mark>예약</mark>을 꼭 하세요."
            ],
            "contact": {"name": "외국인종합안내센터", "phone": "1345"}
        }
    },
]


def run():
    db = SessionLocal()
    try:
        existing = db.query(models.Document).count()
        if existing > 0:
            print(f"이미 {existing}개의 문서가 있어요. seed를 다시 실행하려면 ttobak.db를 삭제하세요.")
            return

        for s in SAMPLES:
            fields = s.pop("fields")
            doc = models.Document(**s, fields=json.dumps(fields, ensure_ascii=False))
            db.add(doc)

        db.commit()
        print(f"[완료] 샘플 문서 {len(SAMPLES)}개를 삽입했어요.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
