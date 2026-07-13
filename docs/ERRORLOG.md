# Error Log: Wiederkehrende Probleme

Hier werden Fehler dokumentiert die Claude wiederholt macht, damit Patterns erkannt und durch Skills/Rules verhindert werden koennen.

**Self-Improvement Loop:** Nach jedem neuen Eintrag hier pruefen ob eine Lesson in
`memory/lessons.md` geschrieben werden muss (Denkmuster-Korrektur, nicht nur Bug-Fix).
Siehe `AGENTS.md` → "Work loop" fuer Details.

## Format
```
### [Kurzbeschreibung]
- **Wann:** [Datum oder Session-Beschreibung]
- **Was passiert:** [Fehlerbeschreibung]
- **Ursache:** [Root Cause wenn bekannt]
- **Fix:** [Was wurde getan]
- **Wiederholung:** [Ja/Nein - trat es erneut auf?]
- **Skill/Rule erstellt:** [Ja/Nein - wenn ja, welche]
- **Lesson:** [Ja/Nein - wenn ja, Kategorie in lessons.md]
```

---

### Architektur-Entscheidung implementiert aber nie getestet mit echten Werten
- **Wann:** 2026-03-01, Carnot-Session
- **Was passiert:** "Intern SI" stand in docs/ARCHITECTURE.md, war aber nie im Solver
  umgesetzt. Solver nahm rohe User-Werte ohne Einheitenkonvertierung. cp=1.005 kJ +
  Rs=296.8 J → cv=1.005-296.8=-295.795 → κ=-0.0034.
- **Ursache:** Architektur-Dokument beschreibt Zielzustand, nicht Ist-Zustand. Kein
  Test der echte gemischte Einheiten prüfte.
- **Fix:** SI-Konvertierung in `calculator-store.ts` `recalculate()` implementiert.
  `setUnit` konvertiert jetzt Wert beim Einheitenwechsel und triggert Neuberechnung.
- **Wiederholung:** Erstmalig dokumentiert.
- **Regel:** Bei neuen Core-Features immer einen Integrationstest mit gemischten
  Einheiten schreiben, nicht nur SI-Einheiten im Test.

### Locale-abhängiges parseFloat (Komma als Dezimaltrennzeichen)
- **Wann:** 2026-03-01, Carnot-Session
- **Was passiert:** User tippt "0,25" (deutsche Locale). `parseFloat("0,25")` = 0.
  Validator: `0 <= 0` → "Druck muss positiv sein". Bug schwer zu erkennen weil
  Fehlermeldung irreführend ist ("nicht negativ" obwohl 0.25 eindeutig positiv).
- **Ursache:** JavaScript `parseFloat` ignoriert alles nach nicht-numerischem Zeichen.
- **Fix:** `raw.replace(',', '.')` vor parseFloat in ValueInput.tsx.
- **Wiederholung:** Erstmalig dokumentiert.
- **Regel:** Alle User-Text-zu-Zahl Konvertierungen müssen Komma als Dezimaltrennzeichen
  akzeptieren. Gilt für alle zukünftigen Input-Komponenten.

### Solver-Reihenfolge physikalisch nicht sinnvoll (offen)
- **Wann:** 2026-03-01, Carnot-Session
- **Was passiert:** Fixed-Point-Solver greift erste lösbare Formel unabhängig von
  physikalischer Reihenfolge der Zustände. Rechenschritte in UI folgen keiner
  nachvollziehbaren Logik (v1 vor T1, Wirkungsgrad vor Zustandsgrößen etc.).
- **Ursache:** Solver hat kein Konzept von physikalischen Abhängigkeiten oder
  Prozessreihenfolge. Ergebnisse sind korrekt, nur Reihenfolge der Steps unlogisch.
- **Fix:** Offen — geplant als FEAT-3 in `src/modules/carnot/TASKS.md`.
- **Wiederholung:** Erstmalig dokumentiert.

---

### Falsche Prozesskonvention im Carnot-Modul (erstes Fix-Attempt)
- **Wann:** 2026-03-01, Session 1 (erster Fix-Versuch)
- **Was passiert:** Isotherme Constraints und adiabate Paare mit vertauschter Konvention
  implementiert: T2=T1, T4=T3 (falsch) statt T2=T3, T4=T1 (korrekt). Adiabate Paare
  [2,3]+[4,1] statt [1,2]+[3,4]. carnot_eta war `1-T3/T1` statt `1-T1/T3`.
- **Ursache:** Kein Referenz-Dokument mit eindeutiger Konvention vor der Implementierung.
  Erste Annahme über Prozessrichtung war falsch.
- **Fix:** Session 2 (2026-03-01) — alle drei Fehler behoben, Konvention in README
  und Testkommentaren dokumentiert.
- **Wiederholung:** Einmalig. Durch README-Dokumentation künftig verhindert.
- **Regel:** Bei Modulen mit fester Prozessstruktur (Carnot, Otto, Diesel): erst die
  Zustandskonvention in README festhalten und mit Nutzer abstimmen, DANN Formeln schreiben.

---

### q_out und w_netto mit falschem Vorzeichen
- **Wann:** 2026-03-02
- **Was passiert:** `q_out = Rs*T1*ln(v4/v1)` lieferte positiven Wert.
  `w_netto = q_in - q_out` war positiv. Beides thermodynamisch falsch für Wärmekraftmaschine
  (Arbeit wird abgegeben = negativ; abgeführte Wärme verlässt System = negativ).
- **Ursache:** Vorzeichen der isotherma Wärmeformel falsch gewählt: ln(v4/v1) > 0,
  aber aus ∫p dV für Kompression 4→1 folgt ln(v1/v4) < 0. Energiebilanz-Formel
  hatte alte Engineering-Konvention (q_out positiv definiert).
- **Fix:** `q_out = Rs*T1*ln(v1/v4)`, `w_netto = -(q_in+q_out)`, `eta = -w_netto/q_in`.
- **Wiederholung:** Erstmalig. Durch Konventionsdokumentation in README verhindert.
- **Regel:** Vorzeichen-Konvention im Modul-README festhalten bevor Formeln geschrieben
  werden. Testfälle explizit mit erwarteten Vorzeichen kommentieren.
