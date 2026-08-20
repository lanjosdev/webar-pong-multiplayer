import { describe, expect, it, vi } from 'vitest'

import { createImageTargetDataLoader, parseImageTargetData } from './image-target-data'

const manifest = {
  metadata: null,
  name: 'pong-marker-v2',
  properties: {
    height: 1448,
    isRotated: false,
    left: 0,
    originalHeight: 1448,
    originalWidth: 1086,
    top: 0,
    width: 1086,
  },
  resources: { luminanceImage: 'pong-marker-v2_luminance.png' },
  type: 'PLANAR',
}

describe('image target data', () => {
  it('validates the generated manifest and resolves the luminance asset under Vite base', () => {
    expect(parseImageTargetData(manifest, '/pong/')).toEqual({
      imagePath: '/pong/image-targets/pong-marker-v2/pong-marker-v2_luminance.png',
      metadata: null,
      name: 'pong-marker-v2',
      properties: manifest.properties,
      type: 'PLANAR',
    })
  })

  it('loads and caches a valid target without touching the camera', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    )
    const loader = createImageTargetDataLoader({ baseUrl: '/', fetch: fetchMock })

    const [first, second] = await Promise.all([loader.load(), loader.load()])

    expect(first).toBe(second)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/image-targets/pong-marker-v2/pong-marker-v2.json')
  })

  it('rejects invalid generated data', () => {
    expect(parseImageTargetData({ ...manifest, properties: { width: 'invalid' } }, '/')).toBeNull()
  })
})
