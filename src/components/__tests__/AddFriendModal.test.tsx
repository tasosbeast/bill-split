import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddFriendModal from "../AddFriendModal";
import type { Friend } from "../../types/legacySnapshot";

// Mock the toast store
vi.mock("../../state/toastStore", () => ({
  useToasts: () => ({
    addToast: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AddFriendModal", () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnCreate.mockClear();
  });

  it("renders the modal with form fields", () => {
    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    expect(screen.getByText("Add Friend")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add friend" })
    ).toBeInTheDocument();
  });

  it("shows helper text for email field", () => {
    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    expect(
      screen.getByText("We won't send anything; it's just a label.")
    ).toBeInTheDocument();
  });

  it("calls onClose when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("shows error when submitting with empty name", async () => {
    const user = userEvent.setup();
    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    await user.click(screen.getByRole("button", { name: "Add friend" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Name is required."
    );
    expect(mockOnCreate).not.toHaveBeenCalled();
  });

  it("shows error when submitting with empty email", async () => {
    const user = userEvent.setup();
    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    await user.type(screen.getByLabelText("Name"), "John");
    await user.click(screen.getByRole("button", { name: "Add friend" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email is required."
    );
    expect(mockOnCreate).not.toHaveBeenCalled();
  });

  it("shows error when submitting with invalid email", async () => {
    const user = userEvent.setup();
    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    await user.type(screen.getByLabelText("Name"), "John");
    await user.type(screen.getByLabelText("Email"), "invalid-email");
    await user.click(screen.getByRole("button", { name: "Add friend" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email address looks invalid."
    );
    expect(mockOnCreate).not.toHaveBeenCalled();
  });

  it("creates friend with valid data", async () => {
    const user = userEvent.setup();
    mockOnCreate.mockReturnValue({ ok: true });

    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    await user.type(screen.getByLabelText("Name"), "John Doe");
    await user.type(screen.getByLabelText("Email"), "john@example.com");
    await user.click(screen.getByRole("button", { name: "Add friend" }));

    await waitFor(() => {
      expect(mockOnCreate).toHaveBeenCalledTimes(1);
    });

    const [callArg] = mockOnCreate.mock.calls[0] as [Friend];
    expect(callArg.name).toBe("John Doe");
    expect(callArg.email).toBe("john@example.com");
    expect(callArg.tag).toBe("friend");
    expect(callArg.active).toBe(true);
    expect(callArg.id).toBeTruthy();
    expect(callArg.createdAt).toBeGreaterThan(0);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("trims whitespace from name and email", async () => {
    const user = userEvent.setup();
    mockOnCreate.mockReturnValue({ ok: true });

    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    await user.type(screen.getByLabelText("Name"), "  John Doe  ");
    await user.type(screen.getByLabelText("Email"), "  john@example.com  ");
    await user.click(screen.getByRole("button", { name: "Add friend" }));

    await waitFor(() => {
      expect(mockOnCreate).toHaveBeenCalledTimes(1);
    });

    const [callArg] = mockOnCreate.mock.calls[0] as [Friend];
    expect(callArg.name).toBe("John Doe");
    expect(callArg.email).toBe("john@example.com");
  });

  it("converts email to lowercase", async () => {
    const user = userEvent.setup();
    mockOnCreate.mockReturnValue({ ok: true });

    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    await user.type(screen.getByLabelText("Name"), "John");
    await user.type(screen.getByLabelText("Email"), "John@EXAMPLE.COM");
    await user.click(screen.getByRole("button", { name: "Add friend" }));

    await waitFor(() => {
      expect(mockOnCreate).toHaveBeenCalledTimes(1);
    });

    const [callArg] = mockOnCreate.mock.calls[0] as [Friend];
    expect(callArg.email).toBe("john@example.com");
  });

  it("shows error when duplicate email is detected", async () => {
    const user = userEvent.setup();
    mockOnCreate.mockReturnValue({ ok: false, reason: "duplicate-email" });

    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    await user.type(screen.getByLabelText("Name"), "John");
    await user.type(screen.getByLabelText("Email"), "existing@example.com");
    await user.click(screen.getByRole("button", { name: "Add friend" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email is already in your friend list."
    );
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("shows generic error when creation fails for unknown reason", async () => {
    const user = userEvent.setup();
    mockOnCreate.mockReturnValue({ ok: false, reason: "unknown" });

    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    await user.type(screen.getByLabelText("Name"), "John");
    await user.type(screen.getByLabelText("Email"), "john@example.com");
    await user.click(screen.getByRole("button", { name: "Add friend" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not add friend. Please try again."
    );
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("clears error when user starts typing after validation error", async () => {
    const user = userEvent.setup();
    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    // Trigger validation error
    await user.click(screen.getByRole("button", { name: "Add friend" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    // Start typing in name field
    await user.type(screen.getByLabelText("Name"), "J");

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("accepts various valid email formats", async () => {
    const user = userEvent.setup();
    mockOnCreate.mockReturnValue({ ok: true });

    const validEmails = [
      "simple@example.com",
      "user+tag@example.co.uk",
      "first.last@subdomain.example.com",
      "123@example.com",
    ];

    for (const email of validEmails) {
      const { unmount } = render(
        <AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      await user.type(screen.getByLabelText("Name"), "Test User");
      await user.type(screen.getByLabelText("Email"), email);
      await user.click(screen.getByRole("button", { name: "Add friend" }));

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalled();
      });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      unmount();
      mockOnCreate.mockClear();
    }
  });

  it("has proper ARIA attributes for error states", async () => {
    const user = userEvent.setup();
    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    const nameInput = screen.getByLabelText("Name");
    const emailInput = screen.getByLabelText("Email");

    // Initially no errors
    expect(nameInput).toHaveAttribute("aria-invalid", "false");
    expect(emailInput).toHaveAttribute("aria-invalid", "false");

    // Trigger error
    await user.click(screen.getByRole("button", { name: "Add friend" }));

    await waitFor(() => {
      expect(nameInput).toHaveAttribute("aria-invalid", "true");
      expect(emailInput).toHaveAttribute("aria-invalid", "true");
    });

    const errorAlert = screen.getByRole("alert");
    expect(errorAlert).toBeInTheDocument();

    // Inputs should be described by error
    const nameDescribedBy = nameInput.getAttribute("aria-describedby");
    const emailDescribedBy = emailInput.getAttribute("aria-describedby");
    expect(nameDescribedBy).toContain(errorAlert.id);
    expect(emailDescribedBy).toContain(errorAlert.id);
  });

  // Skip: Modal focus management is async and tested in Modal.test.tsx
  it.skip("focuses name field when modal opens", () => {
    render(<AddFriendModal onClose={mockOnClose} onCreate={mockOnCreate} />);

    const nameInput = screen.getByLabelText("Name");
    expect(document.activeElement).toBe(nameInput);
  });
});
