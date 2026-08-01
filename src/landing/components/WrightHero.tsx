import { useRef } from 'react'
import { useScrollVideo } from '../motion/useScrollVideo'
import './WrightHero.css'

export interface WrightHeroProps {
  reducedMotion: boolean
}

export function WrightHero({ reducedMotion }: WrightHeroProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useScrollVideo(sectionRef, videoRef, reducedMotion)

  return <section id="haltung" ref={sectionRef} className="wright-hero" aria-labelledby="landing-title">
    <div className="wright-hero-sticky">
      <video
        ref={videoRef}
        className="wright-hero-media"
        muted
        playsInline
        preload="metadata"
        poster="./wright-flyer-poster.webp"
        aria-hidden="true"
      >
        <source src="./wright-flyer-scroll-gop6.mp4" type="video/mp4" />
      </video>
      <div className="wright-hero-copy">
        <p className="wright-hero-kicker">Deterministische Rechenwege</p>
        <h1 id="landing-title">Nicht nur rechnen. Systeme verstehen.</h1>
        <p className="wright-hero-support">
          Bekannte Größen eingeben. Beziehungen prüfen. Den vollständigen Rechenweg nachvollziehen.
        </p>
      </div>
      <p className="wright-motto">Überlieferte Formel ist Ausgangspunkt. Beweis ist das Ziel.</p>
    </div>
  </section>
}
