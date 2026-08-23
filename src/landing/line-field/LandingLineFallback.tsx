import type { CSSProperties } from 'react'
import { lineFieldConfig } from './config/line-field-config.generated'
import type { LineFieldRgb } from './config/line-field-config.types'
import type {
  LandingLineFallbackGeometry,
  LandingLineFallbackProps,
} from './renderer/line-field-renderer.types'
import './LandingLineField.css'

const rgb = (color: LineFieldRgb) => `rgb(${color.map((channel) => Math.round(channel * 255)).join(' ')})`

const defaultGeometry: LandingLineFallbackGeometry = {
  cssWidth: 160,
  cssHeight: 1000,
  anchorLocalX: 24,
  anchorViewportY: 340,
  headerTargetViewportY: 40,
}

const laneControlGeometry = [
  [0, 18, 34, 90, 160, 270],
  [4, 42, 62, 115, 230, 350],
  [10, 64, 92, 140, 295, 430],
  [14, 80, 112, 170, 350, 510],
  [18, 92, 126, 195, 400, 590],
] as const

const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback

function normalizeGeometry(
  geometry: LandingLineFallbackGeometry | undefined,
): LandingLineFallbackGeometry {
  const cssWidth = Math.max(1, finiteOr(geometry?.cssWidth ?? defaultGeometry.cssWidth, defaultGeometry.cssWidth))
  const cssHeight = Math.max(1, finiteOr(geometry?.cssHeight ?? defaultGeometry.cssHeight, defaultGeometry.cssHeight))

  return {
    cssWidth,
    cssHeight,
    anchorLocalX: finiteOr(
      geometry?.anchorLocalX ?? defaultGeometry.anchorLocalX,
      defaultGeometry.anchorLocalX,
    ),
    anchorViewportY: finiteOr(
      geometry?.anchorViewportY ?? defaultGeometry.anchorViewportY,
      defaultGeometry.anchorViewportY,
    ),
    headerTargetViewportY: finiteOr(
      geometry?.headerTargetViewportY ?? defaultGeometry.headerTargetViewportY,
      defaultGeometry.headerTargetViewportY,
    ),
  }
}

export function LandingLineFallback({ theme, geometry }: LandingLineFallbackProps) {
  const palette = theme === 'dark' ? lineFieldConfig.theme.dark : lineFieldConfig.theme.light
  const accent = theme === 'dark'
    ? lineFieldConfig.theme.dark.lineAccent
    : lineFieldConfig.theme.light.paperFiber
  const style = {
    '--line-field-primary': rgb(palette.linePrimary),
    '--line-field-secondary': rgb(palette.lineSecondary),
    '--line-field-accent': rgb(accent),
  } as CSSProperties
  const measured = normalizeGeometry(geometry)
  const availableWidth = Math.max(1, measured.cssWidth - measured.anchorLocalX)
  const availableHeight = Math.max(1, measured.cssHeight - measured.anchorViewportY)
  const defaultAvailableWidth = defaultGeometry.cssWidth - defaultGeometry.anchorLocalX
  const defaultAvailableHeight = defaultGeometry.cssHeight - defaultGeometry.anchorViewportY
  const scaleX = availableWidth / defaultAvailableWidth
  const scaleY = availableHeight / defaultAvailableHeight

  const lanePath = (
    [control1X, control2X, endX, control1Y, control2Y, endY]: typeof laneControlGeometry[number],
  ) => [
    `M ${measured.anchorLocalX} ${measured.anchorViewportY}`,
    `C ${measured.anchorLocalX + control1X * scaleX} ${measured.anchorViewportY + control1Y * scaleY}`,
    `${measured.anchorLocalX + control2X * scaleX} ${measured.anchorViewportY + control2Y * scaleY}`,
    `${measured.anchorLocalX + endX * scaleX} ${measured.anchorViewportY + endY * scaleY}`,
  ].join(' ')

  return (
    <div
      className="landing-line-field__fallback"
      data-line-field-fallback=""
      data-theme={theme}
      aria-hidden="true"
      style={style}
    >
      <svg
        viewBox={`0 0 ${measured.cssWidth} ${measured.cssHeight}`}
        preserveAspectRatio="none"
        focusable="false"
        aria-hidden="true"
      >
        <path
          data-line-field-spine=""
          d={`M ${measured.anchorLocalX} ${measured.headerTargetViewportY} L ${measured.anchorLocalX} ${measured.anchorViewportY}`}
          strokeWidth={lineFieldConfig.geometry.spineWidthPx}
        />
        {laneControlGeometry.map((lane, index) => <path
          key={index}
          data-line-field-lane={index}
          d={lanePath(lane)}
          strokeWidth={lineFieldConfig.geometry.lineWidthPx}
        />)}
      </svg>
    </div>
  )
}
