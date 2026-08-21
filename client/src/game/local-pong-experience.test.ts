import { Mesh, MeshBasicMaterial } from 'three'
import { describe, expect, it } from 'vitest'

import { createLocalPongExperience, type LocalPongViewState } from './local-pong-experience'

function updateFor(
  experience: ReturnType<typeof createLocalPongExperience>,
  seconds: number,
): void {
  const steps = Math.ceil(seconds * 60)
  for (let index = 0; index < steps; index += 1) {
    experience.update(1 / 60)
  }
}

describe('createLocalPongExperience', () => {
  it('requires 750 ms of safe tracking before the player can start', () => {
    const experience = createLocalPongExperience()
    const states: LocalPongViewState[] = []
    experience.subscribe((state) => states.push(state))

    experience.setTrackingSafe(true)
    updateFor(experience, 0.7)
    expect(states.at(-1)?.readyAvailable).toBe(false)
    updateFor(experience, 0.1)
    expect(states.at(-1)?.readyAvailable).toBe(true)

    experience.start()
    expect(states.at(-1)?.phase).toBe('countdown')
    experience.dispose()
  })

  it('moves the blue paddle by relative drag only while playing', () => {
    const experience = createLocalPongExperience()
    experience.setTrackingSafe(true)
    updateFor(experience, 0.8)
    experience.start()
    experience.movePlayerBy(1)
    updateFor(experience, 3.2)

    const player = experience.object3d.getObjectByName('player-paddle')
    expect(player?.position.x).toBe(0)
    experience.movePlayerBy(0.5)
    updateFor(experience, 0.2)
    expect(player?.position.x).toBeGreaterThan(0)
    expect(player?.position.x).toBeLessThanOrEqual(0.18)
    experience.dispose()
  })

  it('freezes gameplay while tracking is unsafe and resumes after stability plus 3-2-1', () => {
    const experience = createLocalPongExperience()
    const states: LocalPongViewState[] = []
    experience.subscribe((state) => states.push(state))
    experience.setTrackingSafe(true)
    updateFor(experience, 0.8)
    experience.start()
    updateFor(experience, 3.2)
    const ball = experience.object3d.getObjectByName('pong-ball')
    const beforePause = ball?.position.clone()

    experience.setTrackingSafe(false)
    updateFor(experience, 1)
    expect(ball?.position).toEqual(beforePause)
    expect(states.at(-1)).toMatchObject({ trackingPaused: true, trackingSafe: false })

    experience.setTrackingSafe(true)
    updateFor(experience, 0.8)
    expect(states.at(-1)?.countdown).toBe(3)
    updateFor(experience, 3.1)
    expect(states.at(-1)?.trackingPaused).toBe(false)
    updateFor(experience, 0.2)
    expect(ball?.position.equals(beforePause ?? ball.position)).toBe(false)
    experience.dispose()
  })

  it('scales authored meter geometry to the dimensions supplied by the AR adapter', () => {
    const experience = createLocalPongExperience()
    experience.setDimensions(2, 4)
    expect(experience.object3d.scale.toArray()).toEqual([4, 4, 4])
    experience.dispose()
  })

  it('fades every game material during an anchor transition', () => {
    const experience = createLocalPongExperience()
    experience.setOpacity(0.5)
    const player = experience.object3d.getObjectByName('player-paddle')
    expect(player).toBeInstanceOf(Mesh)
    const material = (player as Mesh).material
    expect(material).toBeInstanceOf(MeshBasicMaterial)
    expect((material as MeshBasicMaterial).opacity).toBe(0.5)
    experience.dispose()
  })
})
