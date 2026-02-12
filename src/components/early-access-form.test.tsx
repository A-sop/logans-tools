import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EarlyAccessForm } from './early-access-form';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { submitEarlyAccess } from '@/app/actions/early-access';

vi.mock('@/app/actions/early-access');

function renderWithLocale(ui: ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('EarlyAccessForm', () => {
  beforeEach(() => {
    vi.mocked(submitEarlyAccess).mockReset();
  });

  it('renders email input and submit button', () => {
    renderWithLocale(<EarlyAccessForm />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notify me when available/i })).toBeInTheDocument();
  });

  it('shows loading state when submitting', async () => {
    vi.mocked(submitEarlyAccess).mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ success: true, message: 'Thanks!' }), 500))
    );
    const user = userEvent.setup();
    renderWithLocale(<EarlyAccessForm />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /notify me when available/i }));

    expect(screen.getByRole('button', { name: /submitting/i })).toBeInTheDocument();
  });

  it('shows success message after successful submit', async () => {
    vi.mocked(submitEarlyAccess).mockResolvedValue({
      success: true,
      message: "Thanks! We'll notify test@example.com when we launch.",
    });
    const user = userEvent.setup();
    renderWithLocale(<EarlyAccessForm />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /notify me when available/i }));

    await waitFor(() => {
      expect(screen.getByText(/thanks! we'll notify/i)).toBeInTheDocument();
    });
  });

  it('shows error message when submit fails', async () => {
    vi.mocked(submitEarlyAccess).mockResolvedValue({
      success: false,
      error: 'Please enter a valid email address',
    });
    const user = userEvent.setup();
    renderWithLocale(<EarlyAccessForm />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /notify me when available/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('shows client-side error for invalid email and disables submit', async () => {
    const user = userEvent.setup();
    renderWithLocale(<EarlyAccessForm />);

    await user.type(screen.getByLabelText(/email address/i), 'invalid');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /notify me when available/i })).toBeDisabled();
  });
});
