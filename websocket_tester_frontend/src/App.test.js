import { render, screen } from '@testing-library/react';
import App from './App';

test('renders header and controls', () => {
  render(<App />);
  expect(screen.getByText(/WebSocket Tester/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
});
