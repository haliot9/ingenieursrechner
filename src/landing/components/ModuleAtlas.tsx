import { getThermodynamicsModules } from '../model/landing-modules'
import './ModuleAtlas.css'

export interface ModuleAtlasProps {
  onExploreThermodynamics: () => void
}

export function ModuleAtlas({ onExploreThermodynamics }: ModuleAtlasProps) {
  const modules = getThermodynamicsModules()

  return <section id="module" className="module-atlas" aria-labelledby="module-title">
    <p className="landing-eyebrow">Modulatlas</p>
    <h2 id="module-title">Ein System. Endliche, prüfbare Rechenräume.</h2>
    <button type="button" className="module-plaque" onClick={onExploreThermodynamics}>
      <span>Aktives Fachgebiet</span>
      <strong>Thermodynamik</strong>
      <small>{modules.map(module => module.name).join(' · ')}</small>
    </button>
    <article className="future-module" aria-label="Weitere Fachgebiete in Zukunft">
      <span>Future Vision</span>
      <strong>Weitere Fachgebiete</strong>
      <p>Neue Rechenräume erscheinen erst, wenn Modell, Solverpfad und Erklärung belastbar sind.</p>
    </article>
  </section>
}
