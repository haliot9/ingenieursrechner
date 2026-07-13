import type { SolverError } from '../core/types'

interface ErrorDisplayProps {
  errors: SolverError[]
}

export function ErrorDisplay({ errors }: ErrorDisplayProps) {
  if (errors.length === 0) return null

  return (
    <div className="space-y-2" role="alert" aria-live="polite">
      {errors.map((error, i) => (
        <div
          key={i}
          className="p-3 rounded-lg border text-sm"
          style={{
            backgroundColor: error.type === 'insufficient_data'
              ? 'rgba(251, 191, 36, 0.1)'
              : 'rgba(248, 113, 113, 0.1)',
            borderColor: error.type === 'insufficient_data'
              ? 'rgba(251, 191, 36, 0.3)'
              : 'rgba(248, 113, 113, 0.3)',
            color: error.type === 'insufficient_data'
              ? 'var(--warning)'
              : 'var(--error)',
          }}
        >
          {error.type === 'insufficient_data' && '⚠ '}
          {error.type === 'constraint_violation' && '✕ '}
          {error.type === 'computation_error' && '✕ '}
          {error.type === 'contradiction' && '⚡ '}
          {error.message}
        </div>
      ))}
    </div>
  )
}
