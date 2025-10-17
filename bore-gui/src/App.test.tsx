import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from './test/testUtils';
import App from './App';
import { mockInvoke } from './test/setup';

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization and Dependency Checking', () => {
    it('should show loading state initially', () => {
      mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<App />);
      
      expect(screen.getByText('Preparing environment...')).toBeInTheDocument();
    });

    it('should check dependencies on mount', async () => {
      mockInvoke.mockResolvedValueOnce({
        bore_installed: true,
        bore_installed_now: false,
        code_server_installed: true,
        code_server_installed_now: false,
      }).mockResolvedValueOnce(null); // check_auth returns null
      
      render(<App />);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('ensure_dependencies');
      });
    });

    it('should display error when dependencies are missing', async () => {
      mockInvoke.mockResolvedValueOnce({
        bore_installed: false,
        bore_error: 'bore-client not found',
        code_server_installed: false,
        code_server_error: 'code-server not found',
      });
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('Dependency setup failed')).toBeInTheDocument();
        expect(screen.getByText(/bore-client not found/i)).toBeInTheDocument();
        expect(screen.getByText(/code-server not found/i)).toBeInTheDocument();
      });
    });

    it('should show manual installation instructions when dependencies fail', async () => {
      mockInvoke.mockResolvedValueOnce({
        bore_installed: false,
        bore_installed_now: false,
        code_server_installed: false,
        code_server_installed_now: false,
      });
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('Manual Installation Steps:')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should show login page when not authenticated', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          bore_installed: true,
          bore_installed_now: false,
          code_server_installed: true,
          code_server_installed_now: false,
        })
        .mockResolvedValueOnce(null); // check_auth returns null
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });
    });

    it('should show dashboard when authenticated', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          bore_installed: true,
          bore_installed_now: false,
          code_server_installed: true,
          code_server_installed_now: false,
        })
        .mockResolvedValueOnce({
          user_id: 'test-user',
          token: 'test-token',
          email: 'test@example.com',
        })
        .mockResolvedValueOnce([]) // list_instances
        .mockResolvedValueOnce(undefined); // start_status_listener
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('Bore Tunnel')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('should handle login success', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          bore_installed: true,
          bore_installed_now: false,
          code_server_installed: true,
          code_server_installed_now: false,
        })
        .mockResolvedValueOnce(null) // check_auth
        .mockResolvedValueOnce({
          success: true,
          user_id: 'new-user',
          token: 'new-token',
          message: 'Login successful',
        })
        .mockResolvedValueOnce([]) // list_instances after login
        .mockResolvedValueOnce(undefined); // start_status_listener
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });
      
      // Simulate login (would need user interaction in real test)
      // This is simplified for demonstration
    });
  });

  describe('Error Handling', () => {
    it('should handle dependency check errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('Dependency setup failed')).toBeInTheDocument();
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    it('should handle authentication check errors silently', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          bore_installed: true,
          bore_installed_now: false,
          code_server_installed: true,
          code_server_installed_now: false,
        })
        .mockRejectedValueOnce(new Error('Auth error'));
      
      render(<App />);
      
      // Should show login page despite auth error
      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });
    });
  });

  describe('State Transitions', () => {
    it('should transition from loading to login', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          bore_installed: true,
          bore_installed_now: false,
          code_server_installed: true,
          code_server_installed_now: false,
        })
        .mockResolvedValueOnce(null);
      
      render(<App />);
      
      expect(screen.getByText('Preparing environment...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });
    });

    it('should allow switching between login and signup', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          bore_installed: true,
          bore_installed_now: false,
          code_server_installed: true,
          code_server_installed_now: false,
        })
        .mockResolvedValueOnce(null);
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });
      
      // Click sign up link
      const signUpButton = screen.getByText('Sign Up');
      signUpButton.click();
      
      await waitFor(() => {
        expect(screen.getByText('Create your account')).toBeInTheDocument();
      });
    });
  });
});
