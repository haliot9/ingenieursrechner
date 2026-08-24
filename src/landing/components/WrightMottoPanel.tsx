import { forwardRef, useId, type CSSProperties, type RefObject } from 'react'
import { lineFieldConfig } from '../line-field/config/line-field-config.generated'
import type { LandingTheme } from '../theme/useLandingTheme'
import './WrightMottoPanel.css'

const MOTTO_COPY: Record<LandingTheme, string> = {
  light: 'Überlieferte Formel ist Ausgangspunkt. Beweis ist das Ziel.',
  dark: 'Die Formel ist nur das Signal. Die Herleitung macht den Zusammenhang sichtbar.',
}

export interface WrightMottoPanelProps {
  readonly theme: LandingTheme
  readonly reducedMotion: boolean
  readonly cardSlotRef?: RefObject<HTMLDivElement | null>
}

export const WrightMottoPanel = forwardRef<HTMLDivElement, WrightMottoPanelProps>(function WrightMottoPanel(
  { theme, reducedMotion, cardSlotRef },
  ref,
) {
  const statementId = useId()
  const statement = MOTTO_COPY[theme]
  const layoutVariables = {
    '--motto-card-max-width': `${lineFieldConfig.motto.cardMaxWidthRem}rem`,
    '--motto-final-right': `${lineFieldConfig.motto.finalRightInsetVw}vw`,
    '--motto-mobile-final-left': `${lineFieldConfig.motto.mobileFinalLeftInsetRem}rem`,
    '--motto-mobile-final-right': `${lineFieldConfig.motto.mobileFinalRightInsetRem}rem`,
    '--motto-final-center-y': `${Number((lineFieldConfig.motto.finalCenterViewportY * 100).toFixed(6))}%`,
  } as CSSProperties

  return <div
    ref={ref}
    className="wright-motto-panel"
    role="region"
    aria-labelledby={statementId}
    data-motto-theme={theme}
    data-motto-motion={reducedMotion ? 'static' : 'orbit'}
    style={layoutVariables}
  >
    <div ref={cardSlotRef} className="wright-motto-panel__slot">
      <div className="wright-motto-panel__card">
        <p id={statementId} className="wright-motto-panel__statement">{statement}</p>
      </div>
    </div>
  </div>
})
