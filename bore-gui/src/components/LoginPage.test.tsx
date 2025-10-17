import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/testUtils';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import { mockInvoke } from '../test/setup';

describe('LoginPage Component', () => {
  const mockOnLogin = vi.fn();
  const mockOnSwitchToSignUp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render login form with all elements', () => {
      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      expect(screen.getByText('Bore Tunnel')).toBeInTheDocument();
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });

    it('should render email and password inputs with correct placeholders', () => {
      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByPlaceholderText('you@example.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Form Validation', () => {
    it('should require email input', async () => {
      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByLabelText('Email Address');
      expect(emailInput).toHaveAttribute('required');
    });

    it('should require password input', async () => {
      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('required');
    });

    it('should validate email format', () => {
      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByLabelText('Email Address');
      expect(emailInput).toHaveAttribute('type', 'email');
    });
  });

  describe('User Interactions', () => {
    it('should update email input value on change', async () => {
      const user = userEvent.setup();
      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByLabelText('Email Address') as HTMLInputElement;
      await user.type(emailInput, 'test@example.com');

      expect(emailInput.value).toBe('test@example.com');
    });

    it('should update password input value on change', async () => {
      const user = userEvent.setup();
      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      await user.type(passwordInput, 'password123');

      expect(passwordInput.value).toBe('password123');
    });

    it('should call onSwitchToSignUp when sign up link is clicked', async () => {
      const user = userEvent.setup();
      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const signUpButton = screen.getByText('Sign Up');
      await user.click(signUpButton);

      expect(mockOnSwitchToSignUp).toHaveBeenCalledTimes(1);
    });
  });

  describe('Login Submission', () => {
    it('should call invoke with correct parameters on submit', async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce({
        success: true,
        user_id: 'test-user',
        token: 'test-token',
        message: 'Login successful',
      });

      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('login', {
          email: 'test@example.com',
          password: 'password123',
          apiEndpoint: null,
        });
      });
    });

    it('should call onLogin callback on successful login', async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce({
        success: true,
        user_id: 'test-user',
        token: 'test-token',
        message: 'Login successful',
      });

      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalledWith({
          user_id: 'test-user',
          token: 'test-token',
          email: 'test@example.com',
        });
      });
    });

    it('should display error message on login failure', async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce({
        success: false,
        message: 'Invalid credentials',
      });

      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
      expect(mockOnLogin).not.toHaveBeenCalled();
    });

    it('should display error message on network error', async () => {
      const user = userEvent.setup();
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));

      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state during login', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Signing in...')).toBeInTheDocument();
      });
    });

    it('should disable inputs during loading', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(() => new Promise(() => {}));

      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(emailInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('Error Clearing', () => {
    it('should clear error message on new submission', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce({
          success: false,
          message: 'Invalid credentials',
        })
        .mockResolvedValueOnce({
          success: true,
          user_id: 'test-user',
          token: 'test-token',
          message: 'Login successful',
        });

      render(
        <LoginPage onLogin={mockOnLogin} onSwitchToSignUp={mockOnSwitchToSignUp} />
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // First attempt with wrong password
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrong');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });

      // Second attempt
      await user.clear(passwordInput);
      await user.type(passwordInput, 'correct');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
      });
    });
  });
});
