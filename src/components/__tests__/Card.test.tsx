import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../Card'

describe('Card Component', () => {
  it('renders card with children', () => {
    render(
      <Card data-testid="test-card">
        <p>Card content</p>
      </Card>
    )
    
    expect(screen.getByTestId('test-card')).toBeInTheDocument()
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <Card className="custom-card" data-testid="test-card">
        Content
      </Card>
    )
    
    expect(screen.getByTestId('test-card')).toHaveClass('custom-card')
  })

  it('applies custom styles', () => {
    const customStyle = { backgroundColor: 'red' }
    render(
      <Card style={customStyle} data-testid="test-card">
        Content
      </Card>
    )
    
    expect(screen.getByTestId('test-card')).toHaveStyle('background-color: rgb(255, 0, 0)')
  })

  it('merges default and custom styles', () => {
    render(
      <Card style={{ margin: '10px' }} data-testid="test-card">
        Content
      </Card>
    )
    
    const card = screen.getByTestId('test-card')
    expect(card).toHaveStyle('margin: 10px')
    expect(card).toHaveStyle('border: 1px solid #ccc')
  })
})
