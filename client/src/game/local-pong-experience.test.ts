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

    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.7)
    expect(states.at(-1)?.readyAvailable).toBe(false)
    updateFor(experience, 0.1)
    expect(states.at(-1)?.readyAvailable).toBe(true)

    experience.start()
    expect(states.at(-1)?.phase).toBe('countdown')
    experience.dispose()
  })

  it('does not notify the UI again while semantic view state stays unchanged', () => {
    const experience = createLocalPongExperience()
    const states: LocalPongViewState[] = []
    experience.subscribe((state) => states.push(state))

    updateFor(experience, 0.5)

    expect(states).toHaveLength(1)
    experience.dispose()
  })

  it('moves the blue paddle by relative drag only while playing', () => {
    const experience = createLocalPongExperience()
    experience.setTrackingState({ cause: null, safe: true })
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
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    experience.start()
    updateFor(experience, 3.2)
    const ball = experience.object3d.getObjectByName('pong-ball')
    const beforePause = ball?.position.clone()

    experience.setTrackingState({ cause: 'anchor', safe: false })
    updateFor(experience, 1)
    expect(ball?.position).toEqual(beforePause)
    expect(states.at(-1)).toMatchObject({ trackingPaused: true, trackingSafe: false })

    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    expect(states.at(-1)?.countdown).toBe(3)
    updateFor(experience, 3.1)
    expect(states.at(-1)?.trackingPaused).toBe(false)
    updateFor(experience, 0.2)
    expect(ball?.position.equals(beforePause ?? ball.position)).toBe(false)
    experience.dispose()
  })

  it('uses a one-second cue after a sustained world-tracking pause', () => {
    const experience = createLocalPongExperience()
    const states: LocalPongViewState[] = []
    experience.subscribe((state) => states.push(state))
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    experience.start()
    updateFor(experience, 3.2)

    experience.setTrackingState({ cause: 'world', safe: false })
    expect(states.at(-1)).toMatchObject({
      trackingPauseCause: 'world',
      trackingPaused: true,
    })
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    expect(states.at(-1)?.countdown).toBe(1)
    updateFor(experience, 1.1)
    expect(states.at(-1)).toMatchObject({
      trackingPauseCause: null,
      trackingPaused: false,
    })
    experience.dispose()
  })

  it('promotes a world pause to the full countdown when the anchor also becomes unsafe', () => {
    const experience = createLocalPongExperience()
    const states: LocalPongViewState[] = []
    experience.subscribe((state) => states.push(state))
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    experience.start()
    updateFor(experience, 3.2)

    experience.setTrackingState({ cause: 'world', safe: false })
    experience.setTrackingState({ cause: 'anchor', safe: false })
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)

    expect(states.at(-1)).toMatchObject({ countdown: 3, trackingPauseCause: 'anchor' })
    experience.dispose()
  })

  it('resumes an existing core countdown after the brief world cue without stacking another one', () => {
    const experience = createLocalPongExperience()
    const states: LocalPongViewState[] = []
    experience.subscribe((state) => states.push(state))
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    experience.start()
    updateFor(experience, 1.1)

    experience.setTrackingState({ cause: 'world', safe: false })
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    expect(states.at(-1)?.countdown).toBe(1)
    updateFor(experience, 1.1)

    expect(states.at(-1)).toMatchObject({ phase: 'countdown', trackingPaused: false })
    expect(states.at(-1)?.countdown).toBeLessThanOrEqual(2)
    updateFor(experience, 2.1)
    expect(states.at(-1)?.phase).toBe('playing')
    experience.dispose()
  })

  it('restarts an interrupted core countdown at three for an anchor pause without a second countdown', () => {
    const experience = createLocalPongExperience()
    const states: LocalPongViewState[] = []
    experience.subscribe((state) => states.push(state))
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    experience.start()
    updateFor(experience, 1.1)

    experience.setTrackingState({ cause: 'anchor', safe: false })
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    expect(states.at(-1)).toMatchObject({
      countdown: 3,
      phase: 'countdown',
      trackingPaused: false,
    })
    updateFor(experience, 3.1)
    expect(states.at(-1)?.phase).toBe('playing')
    experience.dispose()
  })

  it('only exposes an anchor-correction window outside active play and countdown', () => {
    const experience = createLocalPongExperience()
    expect(experience.canApplyAnchorCorrection?.()).toBe(true)
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    experience.start()
    expect(experience.canApplyAnchorCorrection?.()).toBe(false)
    updateFor(experience, 3.2)
    expect(experience.canApplyAnchorCorrection?.()).toBe(false)
    experience.dispose()
  })

  it('opens an anchor-correction window at the beginning of the point phase', () => {
    const experience = createLocalPongExperience()
    const states: LocalPongViewState[] = []
    experience.subscribe((state) => states.push(state))
    experience.setTrackingState({ cause: null, safe: true })
    updateFor(experience, 0.8)
    experience.start()
    updateFor(experience, 3.2)
    experience.movePlayerBy(1)

    for (let step = 0; step < 3600 && states.at(-1)?.phase !== 'point'; step += 1) {
      experience.update(1 / 60)
    }

    expect(states.at(-1)?.phase).toBe('point')
    expect(experience.canApplyAnchorCorrection?.()).toBe(true)
    updateFor(experience, 0.5)
    expect(experience.canApplyAnchorCorrection?.()).toBe(false)
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
