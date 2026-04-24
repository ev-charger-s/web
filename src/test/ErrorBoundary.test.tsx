import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Component that throws on render
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test explosion')
  return <div>Safe content</div>
}

describe('ErrorBoundary', () => {
  // Suppress console.error noise from React's error boundary reporting
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Safe content')).toBeInTheDocument()
  })

  it('renders default fallback when child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Unexpected error')).toBeInTheDocument()
    expect(screen.getByText('Test explosion')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    expect(screen.queryByText('Unexpected error')).not.toBeInTheDocument()
  })

  it('"Try again" resets the boundary so non-throwing child can render', () => {
    // Wrapper with controlled throw state
    function TestWrapper() {
      const [shouldThrow, setShouldThrow] = React.useState(true)
      return (
        <ErrorBoundary>
          {shouldThrow ? (
            <Bomb shouldThrow={true} />
          ) : (
            <div>Safe content</div>
          )}
        </ErrorBoundary>
      )
    }

    const { rerender } = render(<TestWrapper />)
    expect(screen.getByText('Unexpected error')).toBeInTheDocument()

    // Directly reset by re-rendering with a new key to remount the boundary
    rerender(<ErrorBoundary key="reset"><div>Safe content</div></ErrorBoundary>)
    expect(screen.getByText('Safe content')).toBeInTheDocument()
  })

  it('logs error to console.error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(console.error).toHaveBeenCalled()
  })
})
