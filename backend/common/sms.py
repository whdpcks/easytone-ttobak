"""문자 발송 (A 담당).

TTOBAK_SMS_MODE
    demo (기본) : 실제로 보내지 않음. 앱이 받은 demo_code를 "문자 알림"처럼 보여줌
    그 외       : 실제 발송 업체를 붙이는 자리. (예: NHN Cloud SMS, 네이버 클라우드 SENS, 솔라피)
                  발신번호 사전 등록이 필요합니다.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass

log = logging.getLogger("ttobak.sms")


@dataclass
class SendResult:
    demo: bool


def code_message(code: str) -> str:
    return f"[또박] 인증번호 [{code}]를 입력해 주세요. 3분 안에 넣어야 해요."


def send_code(phone: str, code: str) -> SendResult:
    mode = os.getenv("TTOBAK_SMS_MODE", "demo")
    if mode == "demo":
        log.info("demo SMS to %s****", phone[:3])
        return SendResult(demo=True)
    raise NotImplementedError(f"SMS 모드 '{mode}'는 아직 연결하지 않았어요.")
