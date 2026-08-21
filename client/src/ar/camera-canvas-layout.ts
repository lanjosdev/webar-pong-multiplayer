export interface CameraCanvasLayoutInput {
  devicePixelRatio: number
  maximumPixelRatio?: number
  videoHeight?: number
  videoWidth?: number
  viewportHeight: number
  viewportWidth: number
}

export interface CameraCanvasLayout {
  cssHeight: number
  cssWidth: number
  pixelHeight: number
  pixelWidth: number
}

export const MAX_CAMERA_PIXEL_RATIO = 1.5

function hasVideoSize(
  input: CameraCanvasLayoutInput,
): input is CameraCanvasLayoutInput & { videoHeight: number; videoWidth: number } {
  return Boolean(input.videoWidth && input.videoHeight)
}

export function calculateCameraCanvasLayout(input: CameraCanvasLayoutInput): CameraCanvasLayout {
  const viewportWidth = Math.max(1, input.viewportWidth)
  const viewportHeight = Math.max(1, input.viewportHeight)
  let cssWidth = viewportWidth
  let cssHeight = viewportHeight

  if (hasVideoSize(input)) {
    let videoWidth = input.videoWidth
    let videoHeight = input.videoHeight
    const viewportIsPortrait = viewportHeight >= viewportWidth
    const videoIsPortrait = videoHeight >= videoWidth

    // Some browsers report the sensor's landscape dimensions even while the
    // camera texture is rotated for a portrait viewport.
    if (viewportIsPortrait !== videoIsPortrait) {
      const previousWidth = videoWidth
      videoWidth = videoHeight
      videoHeight = previousWidth
    }

    const videoAspect = videoWidth / videoHeight
    const viewportAspect = viewportWidth / viewportHeight
    if (videoAspect > viewportAspect) {
      cssHeight = viewportWidth / videoAspect
    } else {
      cssWidth = viewportHeight * videoAspect
    }
  }

  const maximumPixelRatio = input.maximumPixelRatio ?? MAX_CAMERA_PIXEL_RATIO
  const pixelRatio = Math.min(maximumPixelRatio, Math.max(1, input.devicePixelRatio))
  return {
    cssHeight,
    cssWidth,
    pixelHeight: Math.max(1, Math.round(cssHeight * pixelRatio)),
    pixelWidth: Math.max(1, Math.round(cssWidth * pixelRatio)),
  }
}
