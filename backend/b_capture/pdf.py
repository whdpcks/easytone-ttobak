"""PDF를 검증하고 원본 전체를 기존 Document Parse로 전달한다."""
from io import BytesIO
from pypdf import PdfReader
from .images import CaptureError, MAX_UPLOAD_BYTES

MAX_PDF_PAGES = 100


def validate_pdf(content: bytes) -> int:
    if len(content) > MAX_UPLOAD_BYTES:
        raise CaptureError(413, "10MB 이하의 PDF를 올려주세요.")
    try:
        reader = PdfReader(BytesIO(content), strict=True)
        if reader.is_encrypted:
            raise CaptureError(400, "암호를 해제한 PDF를 올려주세요.")
        count = len(reader.pages)
        if not count:
            raise CaptureError(400, "페이지가 없는 PDF예요.")
        if count > MAX_PDF_PAGES:
            raise CaptureError(413, "100페이지 이하의 PDF를 올려주세요.")
        for page in reader.pages:
            if float(page.mediabox.width) <= 0 or float(page.mediabox.height) <= 0:
                raise CaptureError(400, "PDF 페이지 크기가 올바르지 않아요.")
        return count
    except CaptureError:
        raise
    except Exception as exc:
        raise CaptureError(400, "PDF를 읽을 수 없어요. 파일을 확인해주세요.") from exc
