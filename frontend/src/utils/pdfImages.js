/* PDF → 페이지 사진 (D, 원문 보기)
   휴대폰마다 PDF를 띄우는 방식이 달라서(안드로이드 크롬은 내려받기만 함),
   pdf.js로 앱 안에서 페이지를 그려 사진처럼 보여 줌.
   - 오래된 아이폰도 되도록 legacy 빌드 사용
   - pdf.js는 PDF가 있을 때만 불러옴 (처음 화면이 무거워지지 않게)
   - isEvalSupported: false — PDF 안의 글꼴 코드를 실행하지 않음 (악성 PDF 대비) */

let pdfjsReady = null;
function loadPdfjs() {
  pdfjsReady ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsReady;
}

// 글꼴이 PDF에 안 들어 있는 한글·한자 문서용 글자 표 (설치한 버전과 같은 것)
const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38';

/** PDF Blob → [{ url, w, h }] (페이지마다 JPG 사진). 다 쓰면 URL.revokeObjectURL(url) */
export async function pdfToImages(blob, width = 1400) {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    isEvalSupported: false,
    cMapUrl: `${PDFJS_CDN}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_CDN}/standard_fonts/`,
  }).promise;
  const images = [];
  try {
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';  // 투명한 PDF도 종이처럼 흰 바탕
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const jpg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      images.push({ url: URL.createObjectURL(jpg), w: canvas.width, h: canvas.height });
      page.cleanup();
    }
  } finally {
    pdf.destroy();
  }
  return images;
}
