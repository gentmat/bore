import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/testUtils';
import userEvent from '@testing-library/user-event';
import CreateInstanceModal from './CreateInstanceModal';
import { mockInvoke, mockOpen } from '../test/setup';

describe('CreateInstanceModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure mockInvoke always returns a Promise to prevent undefined errors
    mockInvoke.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render modal with all elements', () => {
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      expect(screen.getByText('Create New Tunnel Instance')).toBeInTheDocument();
      expect(screen.getByLabelText('Instance Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Project Folder')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create instance/i })).toBeInTheDocument();
    });

    it('should render with default instance name', () => {
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const nameInput = screen.getByLabelText('Instance Name') as HTMLInputElement;
      expect(nameInput.value).toMatch(/^code-server-\d+$/);
    });

    it('should show helpful information', () => {
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      expect(
        screen.getByText(/A friendly name to identify your code-server instance/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/The folder where code-server will open your project/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Port will be automatically selected/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should update instance name on change', async () => {
      const user = userEvent.setup();
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const nameInput = screen.getByLabelText('Instance Name') as HTMLInputElement;
      await user.clear(nameInput);
      await user.type(nameInput, 'my-custom-name');

      expect(nameInput.value).toBe('my-custom-name');
    });

    it('should update project path on change', async () => {
      const user = userEvent.setup();
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const pathInput = screen.getByLabelText('Project Folder') as HTMLInputElement;
      await user.type(pathInput, '/home/user/project');

      expect(pathInput.value).toBe('/home/user/project');
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when X button is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Folder Selection', () => {
    it('should open folder dialog when browse button is clicked', async () => {
      const user = userEvent.setup();
      mockOpen.mockResolvedValueOnce('/home/user/selected-folder');

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const browseButton = screen.getByRole('button', { name: /browse/i });
      await user.click(browseButton);

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith({
          directory: true,
          multiple: false,
          title: 'Select Project Folder',
        });
      });
    });

    it('should update project path when folder is selected', async () => {
      const user = userEvent.setup();
      mockOpen.mockResolvedValueOnce('/home/user/selected-folder');

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const browseButton = screen.getByRole('button', { name: /browse/i });
      await user.click(browseButton);

      await waitFor(() => {
        const pathInput = screen.getByLabelText('Project Folder') as HTMLInputElement;
        expect(pathInput.value).toBe('/home/user/selected-folder');
      });
    });

    it('should not update path when folder selection is cancelled', async () => {
      const user = userEvent.setup();
      mockOpen.mockResolvedValueOnce(null);

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const pathInput = screen.getByLabelText('Project Folder') as HTMLInputElement;
      const initialValue = pathInput.value;

      const browseButton = screen.getByRole('button', { name: /browse/i });
      await user.click(browseButton);

      await waitFor(() => {
        expect(pathInput.value).toBe(initialValue);
      });
    });

    it('should handle folder selection error', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOpen.mockRejectedValueOnce(new Error('Dialog error'));

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const browseButton = screen.getByRole('button', { name: /browse/i });
      await user.click(browseButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Form Validation', () => {
    it('should require instance name', () => {
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const nameInput = screen.getByLabelText('Instance Name');
      expect(nameInput).toHaveAttribute('required');
    });

    it('should require project path', () => {
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const pathInput = screen.getByLabelText('Project Folder');
      expect(pathInput).toHaveAttribute('required');
    });

    it('should prevent submission without project path via required attribute', async () => {
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const pathInput = screen.getByLabelText('Project Folder');
      
      // Verify the input has required attribute which prevents form submission
      expect(pathInput).toHaveAttribute('required');
      expect(pathInput).toHaveValue('');
    });
  });

  describe('Instance Creation', () => {
    it('should create instance with correct parameters', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce(8081) // find_available_port_command
        .mockResolvedValueOnce(undefined); // start_code_server_instance

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const nameInput = screen.getByLabelText('Instance Name');
      const pathInput = screen.getByLabelText('Project Folder');

      await user.clear(nameInput);
      await user.type(nameInput, 'my-instance');
      await user.type(pathInput, '/home/user/project');

      const createButton = screen.getByRole('button', { name: /create instance/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('find_available_port_command', {
          startPort: 8081,
        });
        expect(mockInvoke).toHaveBeenCalledWith('start_code_server_instance', {
          port: 8081,
          instanceName: 'my-instance',
          projectPath: '/home/user/project',
        });
      });
    });

    it('should call onCreate callback on successful creation', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce(8081)
        .mockResolvedValueOnce(undefined);

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const pathInput = screen.getByLabelText('Project Folder');
      await user.type(pathInput, '/home/user/project');

      const createButton = screen.getByRole('button', { name: /create instance/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error message on creation failure', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce(8081)
        .mockRejectedValueOnce(new Error('Failed to start code-server'));

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const pathInput = screen.getByLabelText('Project Folder');
      await user.type(pathInput, '/home/user/project');

      const createButton = screen.getByRole('button', { name: /create instance/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to start code-server/i)).toBeInTheDocument();
      });

      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should handle port finding error', async () => {
      const user = userEvent.setup();
      mockInvoke.mockRejectedValueOnce(new Error('No available ports'));

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const pathInput = screen.getByLabelText('Project Folder');
      await user.type(pathInput, '/home/user/project');

      const createButton = screen.getByRole('button', { name: /create instance/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/No available ports/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state during creation', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce(8081)
        .mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const pathInput = screen.getByLabelText('Project Folder');
      await user.type(pathInput, '/home/user/project');

      const createButton = screen.getByRole('button', { name: /create instance/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });
    });

    it('should disable all inputs during creation', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce(8081)
        .mockImplementation(() => new Promise(() => {}));

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const pathInput = screen.getByLabelText('Project Folder');
      await user.type(pathInput, '/home/user/project');

      const createButton = screen.getByRole('button', { name: /create instance/i });
      await user.click(createButton);

      await waitFor(() => {
        const nameInput = screen.getByLabelText('Instance Name');
        const browseButton = screen.getByRole('button', { name: /browse/i });
        const cancelButton = screen.getByRole('button', { name: /cancel/i });

        expect(nameInput).toBeDisabled();
        expect(pathInput).toBeDisabled();
        expect(browseButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
        expect(createButton).toBeDisabled();
      });
    });
  });

  describe('Error Clearing', () => {
    it('should clear error on new submission attempt', async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce(8081)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(8082)
        .mockResolvedValueOnce(undefined);

      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      const pathInput = screen.getByLabelText('Project Folder');
      await user.type(pathInput, '/home/user/project');

      const createButton = screen.getByRole('button', { name: /create instance/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/First error/i)).toBeInTheDocument();
      });

      // Try again
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.queryByText(/First error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper modal structure', () => {
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create instance/i })).toBeInTheDocument();
    });

    it('should have labels for all inputs', () => {
      render(<CreateInstanceModal onClose={mockOnClose} onCreate={mockOnCreate} />);

      expect(screen.getByLabelText('Instance Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Project Folder')).toBeInTheDocument();
    });
  });
});
