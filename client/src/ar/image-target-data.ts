import type { ImageTargetData } from './engine-contract'

const TARGET_DIRECTORY = 'image-targets/pong-marker-v2/'
const TARGET_MANIFEST = `${TARGET_DIRECTORY}pong-marker-v2.json`

export interface ImageTargetDataLoader {
  load(): Promise<ImageTargetData>
}

export interface ImageTargetDataLoaderOptions {
  baseUrl: string
  fetch: typeof globalThis.fetch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTargetType(value: unknown): value is ImageTargetData['type'] {
  return value === 'PLANAR' || value === 'CYLINDER' || value === 'CONICAL'
}

function parseProperties(value: unknown): Record<string, boolean | number> | null {
  if (!isRecord(value)) {
    return null
  }

  const entries = Object.entries(value)
  if (entries.some(([, item]) => typeof item !== 'boolean' && typeof item !== 'number')) {
    return null
  }

  return Object.fromEntries(entries) as Record<string, boolean | number>
}

function joinBaseUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}${path}`
}

export function parseImageTargetData(value: unknown, baseUrl: string): ImageTargetData | null {
  if (!isRecord(value)) {
    return null
  }

  const resources = value['resources']
  const properties = parseProperties(value['properties'])
  const luminanceImage = isRecord(resources) ? resources['luminanceImage'] : null

  if (
    typeof value['name'] !== 'string' ||
    !isTargetType(value['type']) ||
    !properties ||
    typeof luminanceImage !== 'string'
  ) {
    return null
  }

  return {
    imagePath: joinBaseUrl(baseUrl, `${TARGET_DIRECTORY}${luminanceImage}`),
    metadata: value['metadata'] ?? null,
    name: value['name'],
    properties,
    type: value['type'],
  }
}

export function createImageTargetDataLoader(
  options: ImageTargetDataLoaderOptions,
): ImageTargetDataLoader {
  let targetPromise: Promise<ImageTargetData> | null = null

  return {
    load() {
      if (targetPromise) {
        return targetPromise
      }

      targetPromise = (async () => {
        const response = await options.fetch(joinBaseUrl(options.baseUrl, TARGET_MANIFEST))
        if (!response.ok) {
          throw new Error(`Falha ao carregar o Image Target (HTTP ${String(response.status)}).`)
        }

        const target = parseImageTargetData(await response.json(), options.baseUrl)
        if (!target) {
          throw new Error('Os dados do Image Target são inválidos.')
        }

        return target
      })().catch((error: unknown) => {
        targetPromise = null
        throw error
      })

      return targetPromise
    },
  }
}
