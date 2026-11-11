function orderCorners(points) {
  const center = { x: 0, y: 0 }
  for (const point of points) {
    center.x += point.x / 4
    center.y += point.y / 4
  }
  points.sort((a, b) => (
    Math.atan2(a.y - center.y, a.x - center.x)
    - Math.atan2(b.y - center.y, b.x - center.x)
  ))
  let first = 0
  for (let index = 1; index < 4; index += 1) {
    if (points[index].x + points[index].y < points[first].x + points[first].y) first = index
  }
  return [...points.slice(first), ...points.slice(0, first)]
}

function measureBorder(gray, corners) {
  const contrasts = []
  const clarity = []
  function pixel(point, normal, offset) {
    const x = Math.max(0, Math.min(gray.cols - 1, Math.round(point.x + normal.x * offset)))
    const y = Math.max(0, Math.min(gray.rows - 1, Math.round(point.y + normal.y * offset)))
    return gray.data[y * gray.cols + x]
  }
  for (let index = 0; index < 4; index += 1) {
    const start = corners[index]
    const end = corners[(index + 1) % 4]
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    const normal = { x: -(end.y - start.y) / length, y: (end.x - start.x) / length }
    for (const fraction of [0.25, 0.5, 0.75]) {
      const point = { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction }
      const contrast = Math.abs(pixel(point, normal, 5) - pixel(point, normal, -5))
      contrasts.push(contrast)
      clarity.push(Math.abs(pixel(point, normal, 1) - pixel(point, normal, -1)) / Math.max(contrast, 1))
    }
  }
  contrasts.sort((a, b) => a - b)
  clarity.sort((a, b) => a - b)
  return { contrast: contrasts[6], clarity: clarity[6] }
}

export function detectDocument(cv, image, guide) {
  const source = cv.matFromImageData(image)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const lightRegions = new cv.Mat()
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
  let best = null
  let state = 'searching'

  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY)
    if (cv.mean(gray)[0] < 12) return { state: 'dark', corners: null }
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0)
    cv.Canny(blurred, edges, 30, 100)
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel)
    // Bright-paper segmentation also recovers boundaries with weak or interrupted edges.
    cv.threshold(blurred, lightRegions, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU)
    cv.morphologyEx(lightRegions, lightRegions, cv.MORPH_CLOSE, kernel)

    for (const mask of [edges, lightRegions]) {
      const contours = new cv.MatVector()
      const hierarchy = new cv.Mat()
      try {
        cv.findContours(mask, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
        for (let index = 0; index < contours.size(); index += 1) {
          const contour = contours.get(index)
          const polygon = new cv.Mat()
          const hull = new cv.Mat()
          try {
            const area = cv.contourArea(contour)
            if (area < guide.width * guide.height * 0.12) continue
            // Hands and curled paper create dents and extra vertices in the boundary.
            cv.convexHull(contour, hull)
            const hullArea = cv.contourArea(hull)
            if (area / hullArea < 0.72) continue
            const perimeter = cv.arcLength(hull, true)
            for (const tolerance of [0.025, 0.04, 0.055]) {
              cv.approxPolyDP(hull, polygon, perimeter * tolerance, true)
              if (polygon.rows <= 4) break
            }
            if (polygon.rows !== 4 || !cv.isContourConvex(polygon)) continue
            const corners = orderCorners(Array.from({ length: 4 }, (_, corner) => ({
              x: polygon.data32S[corner * 2], y: polygon.data32S[corner * 2 + 1],
            })))
            // The image boundary itself is not a complete sheet of paper.
            if (corners.some((point) => point.x <= 1 || point.y <= 1 || point.x >= image.width - 2 || point.y >= image.height - 2)) continue
            const sides = corners.map((point, i) => (
              Math.hypot(point.x - corners[(i + 1) % 4].x, point.y - corners[(i + 1) % 4].y)
            ))
            const ratio = (sides[0] + sides[2]) / (sides[1] + sides[3])
            if (ratio < 0.45 || ratio > 1.05) continue
            const margin = Math.min(guide.width, guide.height) * 0.06
            const inside = corners.every((point) => (
              point.x >= guide.x - margin && point.x <= guide.x + guide.width + margin
              && point.y >= guide.y - margin && point.y <= guide.y + guide.height + margin
            ))
            if (!inside) {
              state = 'positioning'
              continue
            }
            if (area < guide.width * guide.height * 0.28) {
              if (state === 'searching') state = 'small'
              continue
            }
            if (!best || area > best.area) best = { corners, area, bounds: cv.boundingRect(polygon) }
          } finally {
            hull.delete()
            polygon.delete()
            contour.delete()
          }
        }
      } finally {
        hierarchy.delete()
        contours.delete()
      }
    }

    if (!best) return { state, corners: null }
    const bounds = best.bounds
    const inset = Math.round(Math.min(bounds.width, bounds.height) * 0.08)
    const region = gray.roi(new cv.Rect(bounds.x + inset, bounds.y + inset, bounds.width - inset * 2, bounds.height - inset * 2))
    const laplacian = new cv.Mat()
    const mean = new cv.Mat()
    const deviation = new cv.Mat()
    try {
      cv.Laplacian(region, laplacian, cv.CV_64F)
      cv.meanStdDev(laplacian, mean, deviation)
      const sharpness = deviation.data64F[0] ** 2
      const border = measureBorder(gray, best.corners)
      // Sharp paper borders allow blank or sparsely printed pages to be captured too.
      const clear = sharpness >= 18 || (border.contrast >= 14 && border.clarity >= 0.45)
      return { state: clear ? 'ready' : 'blurry', corners: best.corners, sharpness }
    } finally {
      deviation.delete()
      mean.delete()
      laplacian.delete()
      region.delete()
    }
  } finally {
    kernel.delete()
    lightRegions.delete()
    edges.delete()
    blurred.delete()
    gray.delete()
    source.delete()
  }
}

export function advanceStability(previous, corners, now, scale) {
  if (!corners) {
    // Brief missed detections pause the countdown instead of resetting it every frame.
    return previous && now - previous.lastSeen <= 450 ? previous : null
  }
  const movement = previous ? Math.max(...corners.map((point, index) => (
    Math.hypot(point.x - previous.anchor[index].x, point.y - previous.anchor[index].y)
  ))) : Infinity
  if (!previous || now - previous.lastSeen > 800 || movement > scale * 0.045) {
    return { anchor: corners, since: now, lastSeen: now, progress: 0 }
  }
  return { ...previous, lastSeen: now, progress: Math.min(1, (now - previous.since) / 900) }
}
