"""업로드한 실제 이미지의 형식과 크기를 확인하고 OCR용 JPEG로 정규화한다."""
from io import BytesIO

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 50_000_000
MAX_IMAGE_EDGE = 2000


class CaptureError(HTTPException):
    def __init__(self, status_code: int, message: str):
        super().__init__(status_code=status_code, detail=message)
        self.message = message


def normalize_image(content: bytes) -> tuple[bytes, int, int]:
    if not content:
        raise CaptureError(400, "사진이 비어 있어요.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise CaptureError(413, "10MB 이하의 사진을 올려주세요.")
    try:
        with Image.open(BytesIO(content)) as image:
            if image.format not in {"JPEG", "PNG"}:
                raise CaptureError(415, "JPG 또는 PNG 사진을 올려주세요.")
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise CaptureError(413, "사진 해상도가 너무 커요.")
            image.load()
            corrected = ImageOps.exif_transpose(image)
            try:
                corrected.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE), Image.Resampling.LANCZOS)
                rgba = corrected.convert("RGBA")
                try:
                    output_image = Image.new("RGB", rgba.size, "white")
                    try:
                        output_image.paste(rgba, mask=rgba.getchannel("A"))
                        output = BytesIO()
                        output_image.save(output, "JPEG", quality=92, optimize=True)
                        return output.getvalue(), output_image.width, output_image.height
                    finally:
                        output_image.close()
                finally:
                    rgba.close()
            finally:
                corrected.close()
    except CaptureError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise CaptureError(413, "사진 해상도가 너무 커요.") from error
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as error:
        raise CaptureError(400, "사진을 읽을 수 없어요. 다시 찍어주세요.") from error
