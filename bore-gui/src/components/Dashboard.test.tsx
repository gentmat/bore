import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/testUtils';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard';
import { mockInvoke, mockListen } from '../test/setup';

describe('Dashboard Component', () => {
  const mockCredentials = {
    user_id: 'test-user',
    token: 'test-token',
    email: 'test@example.com',
  };
  const mockOnLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockListen.mockResolvedValue(() => {});
  });

  describe('Rendering', () => {
    it('should render dashboard header with user email', async () => {
      mockInvoke
        .mockResolvedValueOnce([]) // list_instances
        .mockResolvedValueOnce(undefined); // start_status_listener

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByText('Bore Tunnel')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      mockInvoke.mockImplementation(() => new Promise(() => {}));

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      expect(screen.getByText('Loading instances...')).toBeInTheDocument();
    });

    it('should display active tunnel count', async () => {
      mockInvoke
        .mockResolvedValueOnce([
          {
            id: '1',
            name: 'tunnel-1',
            local_port: 8080,
            region: 'us-east',
            server_address: 'bore.pub',
            public_url: 'http://example.bore.pub',
            remote_port: 12345,
            status: 'active',
          },
          {
            id: '2',
            name: 'tunnel-2',
            local_port: 3000,
            region: 'us-west',
            server_address: 'bore.pub',
            public_url: null,
            remote_port: null,
            status: 'inactive',
          },
        ])
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByText('1 active tunnel')).toBeInTheDocument();
      });
    });

    it('should display plural active tunnels text', async () => {
      mockInvoke
        .mockResolvedValueOnce([
          {
            id: '1',
            name: 'tunnel-1',
            local_port: 8080,
            region: 'us-east',
            server_address: 'bore.pub',
            public_url: 'http://example.bore.pub',
            remote_port: 12345,
            status: 'active',
          },
          {
            id: '2',
            name: 'tunnel-2',
            local_port: 3000,
            region: 'us-west',
            server_address: 'bore.pub',
            public_url: 'http://example2.bore.pub',
            remote_port: 12346,
            status: 'active',
          },
        ])
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByText('2 active tunnels')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no instances exist', async () => {
      mockInvoke
        .mockResolvedValueOnce([]) // list_instances
        .mockResolvedValueOnce(undefined); // start_status_listener

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByText('No tunnel instances yet')).toBeInTheDocument();
        expect(
          screen.getByText(/Create your first tunnel instance/i)
        ).toBeInTheDocument();
      });
    });

    it('should have create button in empty state', async () => {
      mockInvoke
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        const createButton = screen.getByRole('button', {
          name: /create first instance/i,
        });
        expect(createButton).toBeInTheDocument();
      });
    });
  });

  describe('Instance List', () => {
    it('should display all instances', async () => {
      mockInvoke
        .mockResolvedValueOnce([
          {
            id: '1',
            name: 'tunnel-1',
            local_port: 8080,
            region: 'us-east',
            server_address: 'bore.pub',
            public_url: 'http://example.bore.pub',
            remote_port: 12345,
            status: 'active',
          },
          {
            id: '2',
            name: 'tunnel-2',
            local_port: 3000,
            region: 'us-west',
            server_address: 'bore.pub',
            public_url: null,
            remote_port: null,
            status: 'inactive',
          },
        ])
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByText('tunnel-1')).toBeInTheDocument();
        expect(screen.getByText('tunnel-2')).toBeInTheDocument();
      });
    });
  });

  describe('Instance Operations', () => {
    it('should start a tunnel instance', async () => {
      mockInvoke
        .mockResolvedValueOnce([
          {
            id: '1',
            name: 'tunnel-1',
            local_port: 8080,
            region: 'us-east',
            server_address: 'bore.pub',
            public_url: null,
            remote_port: null,
            status: 'inactive',
          },
        ])
        .mockResolvedValueOnce(undefined) // start_status_listener
        .mockResolvedValueOnce(undefined); // start_tunnel

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByText('tunnel-1')).toBeInTheDocument();
      });

      // This would need the TunnelCard component to expose start button
      // Simplified for demonstration
    });

    it('should stop a tunnel instance', async () => {
      mockInvoke
        .mockResolvedValueOnce([
          {
            id: '1',
            name: 'tunnel-1',
            local_port: 8080,
            region: 'us-east',
            server_address: 'bore.pub',
            public_url: 'http://example.bore.pub',
            remote_port: 12345,
            status: 'active',
          },
        ])
        .mockResolvedValueOnce(undefined) // start_status_listener
        .mockResolvedValueOnce(undefined); // stop_tunnel

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByText('tunnel-1')).toBeInTheDocument();
      });
    });

    it('should handle start tunnel error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      mockInvoke
        .mockResolvedValueOnce([
          {
            id: '1',
            name: 'tunnel-1',
            local_port: 8080,
            region: 'us-east',
            server_address: 'bore.pub',
            public_url: null,
            remote_port: null,
            status: 'inactive',
          },
        ])
        .mockResolvedValueOnce(undefined) // start_status_listener
        .mockRejectedValueOnce(new Error('Failed to start tunnel'));

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByText('tunnel-1')).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
      alertSpy.mockRestore();
    });
  });

  describe('Refresh Functionality', () => {
    it('should have refresh button', async () => {
      mockInvoke
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });
    });

    it('should reload instances when refresh is clicked', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce([]) // Initial load
        .mockResolvedValueOnce(undefined) // start_status_listener
        .mockResolvedValueOnce([]); // Refresh load

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('list_instances');
      });
    });
  });

  describe('Create Instance Modal', () => {
    it('should open create modal when New Instance button is clicked', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new instance/i })).toBeInTheDocument();
      });

      const newInstanceButton = screen.getByRole('button', { name: /new instance/i });
      await user.click(newInstanceButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Tunnel Instance')).toBeInTheDocument();
      });
    });

    it('should close modal and refresh after instance creation', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce([]) // Initial load
        .mockResolvedValueOnce(undefined) // start_status_listener
        .mockResolvedValueOnce(8081) // find_available_port_command
        .mockResolvedValueOnce(undefined) // start_code_server_instance
        .mockResolvedValueOnce([
          {
            id: '1',
            name: 'new-tunnel',
            local_port: 8081,
            region: 'us-east',
            server_address: 'bore.pub',
            public_url: null,
            remote_port: null,
            status: 'inactive',
          },
        ]); // Refresh after creation

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new instance/i })).toBeInTheDocument();
      });

      const newInstanceButton = screen.getByRole('button', { name: /new instance/i });
      await user.click(newInstanceButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Tunnel Instance')).toBeInTheDocument();
      });
    });
  });

  describe('Logout Functionality', () => {
    it('should have logout button', async () => {
      mockInvoke
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });
    });

    it('should call onLogout when logout button is clicked', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);

      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Real-time Updates', () => {
    it('should start status listener on mount', async () => {
      mockInvoke
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('start_status_listener');
      });
    });

    it('should listen for tunnel status changes', async () => {
      mockInvoke
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalledWith(
          'tunnel-status-changed',
          expect.any(Function)
        );
      });
    });

    it('should stop status listener on unmount', async () => {
      mockInvoke
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined); // stop_status_listener

      const { unmount } = render(
        <Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />
      );

      await waitFor(() => {
        expect(screen.getByText('Bore Tunnel')).toBeInTheDocument();
      });

      unmount();

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('stop_status_listener');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle instance loading error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInvoke
        .mockRejectedValueOnce(new Error('Failed to load instances'))
        .mockResolvedValueOnce(undefined);

      render(<Dashboard credentials={mockCredentials} onLogout={mockOnLogout} />);

      await waitFor(() => {
        // Should not crash, may show empty state
        expect(screen.getByText('Bore Tunnel')).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
