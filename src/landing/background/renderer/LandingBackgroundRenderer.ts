import { Camera, Geometry, Mesh, Program, Renderer } from 'ogl'
import type { LandingBackgroundDarkConfig } from '../config/landing-background-config.types'
import {
  landingBackgroundFragmentShader,
  landingBackgroundVertexShader,
} from './landing-background-shaders'
import type {
  LandingBackgroundRenderer,
  LandingBackgroundRendererOptions,
} from './landing-background-renderer.types'

const BACKGROUND_VERTICAL_FOV_DEGREES = 42

function diagonalHalfAngleTangent(verticalFovDegrees: number, aspect: number) {
  const verticalHalfAngle = verticalFovDegrees * Math.PI / 360
  return Math.tan(verticalHalfAngle) * Math.hypot(aspect, 1)
}

export function calculateCircumscribedSphereCameraDistance(
  sphereRadius: number,
  verticalFovDegrees: number,
  aspect: number,
) {
  const diagonalTangent = diagonalHalfAngleTangent(verticalFovDegrees, aspect)
  return sphereRadius * Math.hypot(1, 1 / diagonalTangent)
}

export function calculateCircumscribedSphereNearPlane(
  sphereRadius: number,
  verticalFovDegrees: number,
  aspect: number,
) {
  const diagonalTangent = diagonalHalfAngleTangent(verticalFovDegrees, aspect)
  const tangentDepth = sphereRadius / diagonalTangent / Math.hypot(diagonalTangent, 1)
  return Math.max(Number.MIN_VALUE, tangentDepth * 0.5)
}

export function normalizeLandingBackgroundResize(
  width: number,
  height: number,
  deviceDpr: number,
  maximumDpr: number,
) {
  const safeWidth = Number.isFinite(width) && width > 0 ? Math.max(1, Math.round(width)) : 1
  const safeHeight = Number.isFinite(height) && height > 0 ? Math.max(1, Math.round(height)) : 1
  const finiteDpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1
  const finiteMaximumDpr = Number.isFinite(maximumDpr) && maximumDpr >= 0.5
    ? maximumDpr
    : 1
  const effectiveDpr = Math.min(Math.max(finiteDpr, 0.5), finiteMaximumDpr)
  return { effectiveDpr, safeHeight, safeWidth }
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

function createParticleAttributes(config: LandingBackgroundDarkConfig) {
  const random = createSeededRandom(config.seed)
  const positions = new Float32Array(config.count * 3)
  const particleData = new Float32Array(config.count * 2)
  for (let index = 0; index < config.count; index += 1) {
    const radius = Math.cbrt(random()) * config.spread * 0.5
    const azimuth = random() * Math.PI * 2
    const polar = Math.acos(2 * random() - 1)
    const positionOffset = index * 3
    positions[positionOffset] = radius * Math.sin(polar) * Math.cos(azimuth)
    positions[positionOffset + 1] = radius * Math.sin(polar) * Math.sin(azimuth)
    positions[positionOffset + 2] = radius * Math.cos(polar)
    const dataOffset = index * 2
    particleData[dataOffset] = random()
    particleData[dataOffset + 1] = random()
  }
  return { particleData, positions }
}

function requestContextLoss(gl: WebGL2RenderingContext) {
  try {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    // Context loss is best-effort cleanup after owned resources are removed.
  }
}

export function createLandingBackgroundRenderer(
  host: HTMLElement,
  config: LandingBackgroundDarkConfig,
  options: LandingBackgroundRendererOptions = {},
): LandingBackgroundRenderer {
  const canvas = document.createElement('canvas')
  canvas.className = 'landing-background-field__canvas'
  canvas.dataset.backgroundCanvas = 'dark-particles'
  canvas.setAttribute('aria-hidden', 'true')
  let oglRenderer: Renderer | null = null
  let program: Program | null = null
  let geometry: Geometry | null = null
  let lossListenerAttached = false

  const onContextLost = () => options.onContextLost?.()

  try {
    oglRenderer = new Renderer({
      alpha: true,
      antialias: false,
      canvas,
      depth: true,
      dpr: 1,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      stencil: false,
      webgl: 2,
    })
    if (!oglRenderer.isWebgl2) throw new Error('Landing background requires WebGL2')
    const gl = oglRenderer.gl as WebGL2RenderingContext & typeof oglRenderer.gl
    gl.clearColor(0, 0, 0, 0)
    const camera = new Camera(gl, {
      aspect: 1,
      far: config.spread * 6,
      fov: BACKGROUND_VERTICAL_FOV_DEGREES,
      near: calculateCircumscribedSphereNearPlane(
        config.spread * 0.5,
        BACKGROUND_VERTICAL_FOV_DEGREES,
        1,
      ),
    })
    camera.position.set(0, 0, calculateCircumscribedSphereCameraDistance(
      config.spread * 0.5,
      BACKGROUND_VERTICAL_FOV_DEGREES,
      1,
    ))
    camera.lookAt([0, 0, 0])

    const attributes = createParticleAttributes(config)
    geometry = new Geometry(gl, {
      position: { data: attributes.positions, size: 3 },
      particleData: { data: attributes.particleData, size: 2 },
    })
    const uniforms = {
      elapsedSeconds: { value: 0 },
      movementSpeed: { value: config.speed },
      spread: { value: config.spread },
      baseSize: { value: config.baseSize },
      effectiveDpr: { value: 1 },
      hoverFactor: { value: config.hoverFactor },
      pointer: { value: new Float32Array([0, 0]) },
      opacity: { value: config.opacity },
      glowStrength: { value: config.glowStrength },
    }
    program = new Program(gl, {
      cullFace: false,
      depthTest: true,
      depthWrite: false,
      fragment: landingBackgroundFragmentShader,
      transparent: true,
      uniforms,
      vertex: landingBackgroundVertexShader,
    })
    if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program.program) || 'Landing background shader link failed')
    }
    const mesh = new Mesh(gl, {
      frustumCulled: false,
      geometry,
      mode: gl.POINTS,
      program,
    })
    canvas.addEventListener('webglcontextlost', onContextLost)
    lossListenerAttached = true
    host.append(canvas)

    let disposed = false
    return {
      resize(width, height, deviceDpr) {
        if (disposed) return
        const { effectiveDpr, safeHeight, safeWidth } = normalizeLandingBackgroundResize(
          width,
          height,
          deviceDpr,
          config.maximumDpr,
        )
        oglRenderer!.dpr = effectiveDpr
        oglRenderer!.setSize(safeWidth, safeHeight)
        const aspect = safeWidth / safeHeight
        camera.position.set(0, 0, calculateCircumscribedSphereCameraDistance(
          config.spread * 0.5,
          BACKGROUND_VERTICAL_FOV_DEGREES,
          aspect,
        ))
        camera.perspective({
          aspect,
          near: calculateCircumscribedSphereNearPlane(
            config.spread * 0.5,
            BACKGROUND_VERTICAL_FOV_DEGREES,
            aspect,
          ),
        })
        uniforms.effectiveDpr.value = effectiveDpr
      },
      render(frame) {
        if (disposed) return
        uniforms.elapsedSeconds.value = frame.elapsedSeconds
        uniforms.pointer.value[0] = frame.pointer[0]
        uniforms.pointer.value[1] = frame.pointer[1]
        mesh.rotation.x = Math.sin(frame.elapsedSeconds * config.rotationSpeed * 0.43) * 0.08
        mesh.rotation.y = frame.elapsedSeconds * config.rotationSpeed
        oglRenderer!.render({ camera, scene: mesh })
      },
      dispose() {
        if (disposed) return
        disposed = true
        canvas.removeEventListener('webglcontextlost', onContextLost)
        lossListenerAttached = false
        program!.remove()
        geometry!.remove()
        requestContextLoss(gl)
        canvas.remove()
      },
    }
  } catch (error) {
    if (lossListenerAttached) canvas.removeEventListener('webglcontextlost', onContextLost)
    program?.remove()
    geometry?.remove()
    if (oglRenderer?.isWebgl2) requestContextLoss(oglRenderer.gl as WebGL2RenderingContext)
    canvas.remove()
    throw error
  }
}
