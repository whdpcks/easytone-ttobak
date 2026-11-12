"""재현 가능한 가상 안내문 이미지 생성기. 실제 개인정보를 사용하지 않습니다.

실행: python backend/tests/fixtures/generate_sample_notice.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUTPUT = Path(__file__).with_name("sample_application_notice.png")
LINES = [
    ("가온문화센터", 46),
    ("2026년 겨울 디지털 교육 신청 안내", 54),
    ("신청 시작: 2026년 11월 20일", 36),
    ("신청 마감: 2026년 11월 30일", 36),
    ("대상: 교육 참여를 원하는 지역 주민", 32),
    ("준비물: 참가 신청서 1부", 32),
    ("제출 장소: 가온문화센터 1층 안내 데스크", 30),
    ("모든 내용은 테스트를 위한 가상 정보입니다.", 27),
]


def _font(size: int):
    candidates = (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    )
    for candidate in candidates:
        if Path(candidate).is_file():
            return ImageFont.truetype(candidate, size=size)
    raise RuntimeError("가상 안내문 생성에는 한글을 지원하는 Noto 또는 나눔 글꼴이 필요합니다.")


def main():
    image = Image.new("RGB", (1200, 1500), "#ffffff")
    draw = ImageDraw.Draw(image)
    draw.rectangle((55, 55, 1145, 1445), outline="#d3dbe4", width=4)
    draw.rectangle((55, 55, 1145, 190), fill="#eaf3ff")
    y = 92
    for index, (line, font_size) in enumerate(LINES):
        if index == 1:
            y += 120
        elif index == 2:
            y += 95
        elif index > 2:
            y += 112
        draw.text((105, y), line, font=_font(font_size), fill="#162b45")
    image.save(OUTPUT, format="PNG", optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
