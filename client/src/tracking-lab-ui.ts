import type { ArRuntime, TrackingLabConfig, TrackingSnapshot } from './ar'
import {
  CAMERA_DISTANCE_OPTIONS,
  DEFAULT_TRACKING_LAB_CONFIG,
  FIELD_LENGTH_OPTIONS,
  reportFilename,
  TARGET_SIZE_OPTIONS,
  TrackingTrialRecorder,
  TRIAL_SCENARIO_OPTIONS,
  type TrackingTrialReport,
} from './tracking-lab'

export interface TrackingLabUi {
  dispose(): void
  element: HTMLElement
  setSessionState(configurationLocked: boolean, trialEnabled: boolean): void
}

function option(value: string, label: string): HTMLOptionElement {
  const element = document.createElement('option')
  element.value = value
  element.textContent = label
  return element
}

function labeledControl(
  label: string,
  control: HTMLInputElement | HTMLSelectElement,
): HTMLLabelElement {
  const element = document.createElement('label')
  element.className = 'lab-field'
  const text = document.createElement('span')
  text.textContent = label
  element.append(text, control)
  return element
}

function downloadReport(report: TrackingTrialReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.download = reportFilename(report)
  anchor.href = url
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function snapshotLabel(snapshot: TrackingSnapshot, config: TrackingLabConfig): string {
  const target =
    snapshot.targetStatus === 'visible'
      ? 'target visível'
      : snapshot.targetStatus === 'lost'
        ? 'target perdido'
        : 'procurando target'
  const world = config.mode === 'image-only' ? 'SLAM desligado' : `SLAM ${snapshot.worldStatus}`
  const fps = snapshot.framesPerSecond ? ` · ${snapshot.framesPerSecond.toFixed(1)} FPS` : ''
  if (snapshot.worldLimitedExceeded) {
    return `${target} · calibração congelada; reenquadre o target${fps}`
  }
  if (snapshot.recalibrationRequired) {
    return `${target} · recalibração necessária${fps}`
  }
  if (config.mode === 'world-absolute' && snapshot.worldStatus !== 'normal') {
    return `${target} · mova o celular lentamente para frente e para trás${fps}`
  }
  return `${target} · ${world}${fps}`
}

export function createTrackingLabUi(runtime: ArRuntime, windowRef: Window): TrackingLabUi {
  let config: TrackingLabConfig = { ...DEFAULT_TRACKING_LAB_CONFIG }
  const recorder = new TrackingTrialRecorder()
  runtime.configureTrackingLab(config)

  const aside = document.createElement('aside')
  aside.className = 'tracking-lab'
  aside.setAttribute('aria-label', 'Laboratório de tracking')

  const details = document.createElement('details')
  details.open = true
  const summary = document.createElement('summary')
  summary.textContent = 'Laboratório de tracking'

  const form = document.createElement('div')
  form.className = 'lab-form'
  const configurableControls: Array<HTMLInputElement | HTMLSelectElement> = []

  const deviceInput = document.createElement('input')
  deviceInput.autocomplete = 'off'
  deviceInput.placeholder = 'Ex.: iPhone 14'
  deviceInput.value = windowRef.navigator.platform || ''
  configurableControls.push(deviceInput)

  const targetSelect = document.createElement('select')
  for (const [index, target] of TARGET_SIZE_OPTIONS.entries()) {
    targetSelect.append(option(String(index), target.label))
  }
  targetSelect.value = '1'
  configurableControls.push(targetSelect)

  const fieldSelect = document.createElement('select')
  for (const length of FIELD_LENGTH_OPTIONS) {
    fieldSelect.append(option(String(length), `${String(length)} × ${String(length / 2)} m`))
  }
  fieldSelect.value = String(config.fieldLengthMeters)
  configurableControls.push(fieldSelect)

  const modeSelect = document.createElement('select')
  modeSelect.append(
    option('image-only', 'Image Tracking'),
    option('world-relative', 'Target + SLAM relativo'),
    option('world-absolute', 'Target + SLAM absoluto'),
  )
  modeSelect.value = config.mode
  configurableControls.push(modeSelect)

  const distanceSelect = document.createElement('select')
  for (const distance of CAMERA_DISTANCE_OPTIONS) {
    distanceSelect.append(option(String(distance), `${String(distance)} m`))
  }
  distanceSelect.value = String(config.cameraDistanceMeters)
  configurableControls.push(distanceSelect)

  const scenarioSelect = document.createElement('select')
  for (const scenario of TRIAL_SCENARIO_OPTIONS) {
    scenarioSelect.append(option(scenario.value, scenario.label))
  }
  scenarioSelect.value = config.trialScenario
  configurableControls.push(scenarioSelect)

  form.append(
    labeledControl('Aparelho', deviceInput),
    labeledControl('Target físico', targetSelect),
    labeledControl('Campo', fieldSelect),
    labeledControl('Tracking', modeSelect),
    labeledControl('Distância', distanceSelect),
    labeledControl('Cenário', scenarioSelect),
  )

  const liveStatus = document.createElement('p')
  liveStatus.className = 'lab-live-status'
  liveStatus.textContent = 'Sessão não iniciada.'
  liveStatus.setAttribute('aria-live', 'polite')

  const actions = document.createElement('div')
  actions.className = 'lab-actions'
  const startTrial = document.createElement('button')
  startTrial.type = 'button'
  startTrial.textContent = 'Iniciar ensaio'
  startTrial.disabled = true
  const finishTrial = document.createElement('button')
  finishTrial.type = 'button'
  finishTrial.textContent = 'Finalizar e exportar'
  finishTrial.disabled = true
  const recalibrate = document.createElement('button')
  recalibrate.type = 'button'
  recalibrate.textContent = 'Recalibrar campo'
  recalibrate.disabled = true
  actions.append(startTrial, finishTrial, recalibrate)

  details.append(summary, form, liveStatus, actions)
  aside.append(details)

  const updateConfig = () => {
    const target = TARGET_SIZE_OPTIONS[Number.parseInt(targetSelect.value, 10)]
    const fieldLength = Number.parseFloat(fieldSelect.value)
    const cameraDistance = Number.parseFloat(distanceSelect.value)
    const mode = modeSelect.value
    const trialScenario = scenarioSelect.value
    if (
      !target ||
      !FIELD_LENGTH_OPTIONS.includes(fieldLength as TrackingLabConfig['fieldLengthMeters']) ||
      !CAMERA_DISTANCE_OPTIONS.includes(
        cameraDistance as TrackingLabConfig['cameraDistanceMeters'],
      ) ||
      !['image-only', 'world-relative', 'world-absolute'].includes(mode) ||
      !TRIAL_SCENARIO_OPTIONS.some(({ value }) => value === trialScenario)
    ) {
      throw new Error('Configuração inválida do laboratório de tracking.')
    }
    config = {
      cameraDistanceMeters: cameraDistance as TrackingLabConfig['cameraDistanceMeters'],
      enabled: true,
      fieldLengthMeters: fieldLength as TrackingLabConfig['fieldLengthMeters'],
      mode: mode as TrackingLabConfig['mode'],
      targetHeightMeters: target.heightMeters,
      targetWidthMeters: target.widthMeters,
      trialScenario: trialScenario as TrackingLabConfig['trialScenario'],
    }
    runtime.configureTrackingLab(config)
  }

  for (const control of configurableControls) {
    control.addEventListener('change', updateConfig)
  }

  const unsubscribeTracking = runtime.subscribeTracking((snapshot) => {
    liveStatus.textContent = snapshotLabel(snapshot, config)
    recorder.add(snapshot)
    recalibrate.disabled = snapshot.targetPose === null || snapshot.worldLimitedExceeded
  })

  const handleStartTrial = () => {
    recorder.start(
      config,
      {
        browser: windowRef.navigator.userAgent,
        device: deviceInput.value.trim() || 'não informado',
        orientation: windowRef.matchMedia('(orientation: landscape)').matches
          ? 'landscape'
          : 'portrait',
        viewportHeight: windowRef.innerHeight,
        viewportWidth: windowRef.innerWidth,
      },
      new Date(),
    )
    startTrial.disabled = true
    finishTrial.disabled = false
    liveStatus.dataset['recording'] = 'true'
  }

  const handleFinishTrial = () => {
    const report = recorder.finish(new Date())
    downloadReport(report)
    startTrial.disabled = false
    finishTrial.disabled = true
    delete liveStatus.dataset['recording']
  }

  const handleRecalibrate = () => runtime.recalibrateTracking()
  startTrial.addEventListener('click', handleStartTrial)
  finishTrial.addEventListener('click', handleFinishTrial)
  recalibrate.addEventListener('click', handleRecalibrate)

  return {
    dispose() {
      for (const control of configurableControls) {
        control.removeEventListener('change', updateConfig)
      }
      startTrial.removeEventListener('click', handleStartTrial)
      finishTrial.removeEventListener('click', handleFinishTrial)
      recalibrate.removeEventListener('click', handleRecalibrate)
      unsubscribeTracking()
      aside.remove()
    },
    element: aside,
    setSessionState(configurationLocked, trialEnabled) {
      for (const control of configurableControls) {
        control.disabled = configurationLocked
      }
      startTrial.disabled = !trialEnabled || recorder.isRecording
      finishTrial.disabled = !recorder.isRecording
      if (!trialEnabled) {
        recalibrate.disabled = true
      }
    },
  }
}
