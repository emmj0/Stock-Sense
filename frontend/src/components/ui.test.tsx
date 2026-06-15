import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChangePill, StatCard } from './ui';
import { TrendingUp } from 'lucide-react';

describe('ChangePill', () => {
  test('uses the up style for positive values', () => {
    const { container } = render(<ChangePill value={2.5}>+2.5%</ChangePill>);
    const span = container.querySelector('span');
    expect(span?.className).toContain('pill-up');
    expect(screen.getByText('+2.5%')).toBeInTheDocument();
  });

  test('uses the down style for negative values', () => {
    const { container } = render(<ChangePill value={-1}>-1%</ChangePill>);
    expect(container.querySelector('span')?.className).toContain('pill-down');
  });

  test('uses the flat style for zero', () => {
    const { container } = render(<ChangePill value={0}>0%</ChangePill>);
    expect(container.querySelector('span')?.className).toContain('pill-flat');
  });
});

describe('StatCard', () => {
  test('renders its label and value', () => {
    render(<StatCard icon={TrendingUp} label="Balance" value="Rs 1,000" />);
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('Rs 1,000')).toBeInTheDocument();
  });
});
