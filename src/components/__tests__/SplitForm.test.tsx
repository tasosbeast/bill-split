import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SplitForm from "../SplitForm";
import type { LegacyFriend } from "../../types/legacySnapshot";

// Mock buildSplitTransaction
vi.mock("../../lib/transactions", () => ({
  buildSplitTransaction: vi.fn((params: Record<string, unknown>) => ({
    id: "mock-transaction-id",
    date: new Date().toISOString(),
    ...params,
  })),
}));

const mockFriends: LegacyFriend[] = [
  {
    id: "friend1",
    name: "Alice",
    email: "alice@example.com",
    active: true,
    createdAt: Date.now(),
  },
  {
    id: "friend2",
    name: "Bob",
    email: "bob@example.com",
    active: true,
    createdAt: Date.now(),
  },
  {
    id: "friend3",
    name: "Charlie",
    email: "charlie@example.com",
    active: true,
    createdAt: Date.now(),
  },
];

describe("SplitForm", () => {
  const mockOnSplit = vi.fn();
  const mockOnAutomation = vi.fn();
  const mockOnRequestTemplate = vi.fn();

  beforeEach(() => {
    mockOnSplit.mockClear();
    mockOnAutomation.mockClear();
    mockOnRequestTemplate.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Initial rendering", () => {
    it("renders bill amount input", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      const billInput = screen.getByLabelText(/bill amount/i);
      expect(billInput).toBeInTheDocument();
      expect(billInput).toHaveValue(null);
    });

    it("renders category dropdown with all categories", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      const categorySelect = screen.getByLabelText(/category/i);
      expect(categorySelect).toBeInTheDocument();

      // Check that categories are rendered (component uses CATEGORIES from lib/categories)
      const options = screen.getAllByRole("option");
      expect(options.length).toBeGreaterThan(5); // Should have multiple categories
    });

    it("renders note textarea", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      const noteTextarea = screen.getByLabelText(/note/i);
      expect(noteTextarea).toBeInTheDocument();
    });

    it("renders submit button", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      const submitButtons = screen.getAllByRole("button", {
        name: "Save split",
      });
      expect(submitButtons.length).toBeGreaterThan(0);
    });

    it("renders 'You' as default participant", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // "You" should be in the participants section - check for the input
      const yourInput = screen.getByLabelText(/your share/i);
      expect(yourInput).toBeInTheDocument();
    });

    it("renders add participant dropdown", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Should have combobox for adding friends
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThan(0);
    });

    it("renders all category options", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Category dropdown should have options
      const categorySelect = screen.getByLabelText(/category/i);
      const options = within(categorySelect).getAllByRole("option");

      // Should include common categories like Food, Transport, Entertainment, etc.
      expect(options.length).toBeGreaterThan(5);
    });

    it("shows payer dropdown", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Payer dropdown should exist
      const comboboxes = screen.getAllByRole("combobox");
      // Should have at least 2 comboboxes: add friend and payer
      expect(comboboxes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Adding participants", () => {
    it("can add a friend to participants", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Find the add friend dropdown (first combobox)
      const comboboxes = screen.getAllByRole("combobox");
      const addFriendSelect = comboboxes.find((cb) => {
        const options = within(cb).queryAllByRole("option");
        return options.some((opt: HTMLElement) =>
          opt.textContent?.includes("Alice")
        );
      });

      expect(addFriendSelect).toBeDefined();

      // Select a friend
      await user.selectOptions(addFriendSelect!, "friend1");

      // Friend should now appear in participants
      await waitFor(() => {
        expect(screen.getByText(/alice's share/i)).toBeInTheDocument();
      });
    });

    it("can add multiple friends", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Add Alice
      const comboboxes1 = screen.getAllByRole("combobox");
      const addFriendSelect1 = comboboxes1.find((cb) => {
        const options = within(cb).queryAllByRole("option");
        return options.some((opt: HTMLElement) =>
          opt.textContent?.includes("Alice")
        );
      });

      await user.selectOptions(addFriendSelect1!, "friend1");
      await waitFor(() => {
        expect(screen.getByText(/alice's share/i)).toBeInTheDocument();
      });

      // Re-query comboboxes after state update
      const comboboxes2 = screen.getAllByRole("combobox");
      const addFriendSelect2 = comboboxes2.find((cb) => {
        const options = within(cb).queryAllByRole("option");
        return options.some((opt: HTMLElement) =>
          opt.textContent?.includes("Bob")
        );
      });

      // Add Bob
      await user.selectOptions(addFriendSelect2!, "friend2");
      await waitFor(() => {
        expect(screen.getByText(/bob's share/i)).toBeInTheDocument();
      });
    });

    it("shows 'Add a friend' placeholder when no friend selected", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Should have "Select a friend" option visible
      const selectOptions = screen.getAllByText("Select a friend");
      expect(selectOptions.length).toBeGreaterThan(0);
    });
  });

  describe("Removing participants", () => {
    it("shows remove button for added friends", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Add Alice
      const comboboxes = screen.getAllByRole("combobox");
      const addFriendSelect = comboboxes.find((cb) => {
        const options = within(cb).queryAllByRole("option");
        return options.some((opt: HTMLElement) =>
          opt.textContent?.includes("Alice")
        );
      });

      await user.selectOptions(addFriendSelect!, "friend1");

      await waitFor(() => {
        expect(screen.getByText(/alice's share/i)).toBeInTheDocument();
      });

      // Should have a remove button for Alice
      const removeButtons = screen.getAllByRole("button", { name: /remove/i });
      expect(removeButtons.length).toBeGreaterThan(0);
    });

    it("can remove a friend participant", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Add Alice
      const comboboxes = screen.getAllByRole("combobox");
      const addFriendSelect = comboboxes.find((cb) => {
        const options = within(cb).queryAllByRole("option");
        return options.some((opt: HTMLElement) =>
          opt.textContent?.includes("Alice")
        );
      });

      await user.selectOptions(addFriendSelect!, "friend1");
      await waitFor(() => {
        expect(screen.getByText(/alice's share/i)).toBeInTheDocument();
      });

      // Remove Alice
      const removeButtons = screen.getAllByRole("button", { name: /remove/i });
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText(/alice's share/i)).not.toBeInTheDocument();
      });
    });

    it("cannot remove 'You' participant", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // "You" should not have a remove button
      // Check that there are no remove buttons by default (only "You" is present initially)
      const removeButtons = screen.queryAllByRole("button", {
        name: /remove/i,
      });
      expect(removeButtons.length).toBe(0);
    });
  });

  describe("Input validation", () => {
    it("accepts valid bill amount input", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      const billInput = screen.getByLabelText(/bill amount/i);
      await user.type(billInput, "100.50");

      expect(billInput).toHaveValue(100.5);
    });

    it("shows error when submitting without required fields", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Type 0 so native required passes but our validation fails
      const billInput = screen.getByLabelText(/bill amount/i);
      await user.type(billInput, "0");

      const submitButton = screen.getByRole("button", { name: "Save split" });
      await user.click(submitButton);

      // Should show error about required bill amount
      await waitFor(() => {
        expect(
          screen.getByText(/enter a valid total amount/i)
        ).toBeInTheDocument();
      });
    });

    it("validates participant amounts", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Enter bill amount
      const billInput = screen.getByLabelText(/bill amount/i);
      await user.type(billInput, "100");

      // Try to submit without entering participant amounts and without adding a friend
      const submitButton = screen.getByRole("button", { name: "Save split" });
      await user.click(submitButton);

      // Should show error about needing at least one friend participant
      await waitFor(() => {
        expect(
          screen.getByText(/add at least one friend to split the bill/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Split evenly", () => {
    it("split evenly button is disabled when bill amount is empty", () => {
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      const splitEvenlyButton = screen.getByRole("button", {
        name: /split evenly/i,
      });
      expect(splitEvenlyButton).toBeDisabled();
    });

    it("split evenly button is enabled when bill amount is entered", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      const billInput = screen.getByLabelText(/bill amount/i);
      await user.type(billInput, "100");

      const splitEvenlyButton = screen.getByRole("button", {
        name: /split evenly/i,
      });
      await waitFor(() => {
        expect(splitEvenlyButton).toBeEnabled();
      });
    });
  });

  describe("Draft handling", () => {
    it("loads draft total when provided", () => {
      const draft: {
        id: string;
        total: number;
        payer: string;
        category: string;
        note: string;
        participants: { id: string; amount: number }[];
      } = {
        id: "draft-1",
        total: 150,
        payer: "you",
        category: "Food & Dining",
        note: "Test note",

        participants: [
          { id: "you", amount: 75 },
          { id: "friend1", amount: 75 },
        ],
      };

      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
          draft={draft}
        />
      );

      const billInput = screen.getByLabelText(/bill amount/i);
      expect(billInput).toHaveValue(150);
    });

    it("loads draft category when provided", () => {
      const draft: {
        id: string;
        total: number;
        payer: string;
        category: string;
        note: string;
        participants: { id: string; amount: number }[];
      } = {
        id: "draft-1",
        total: 150,
        payer: "you",
        category: "Entertainment",
        note: "",

        participants: [{ id: "you", amount: 75 }],
      };

      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
          draft={draft}
        />
      );

      const categorySelect = screen.getByLabelText(/category/i);
      expect(categorySelect).toHaveValue("Entertainment");
    });

    it("loads draft note when provided", async () => {
      const draft: {
        id: string;
        total: number;
        payer: string;
        category: string;
        note: string;
        participants: { id: string; amount: number }[];
      } = {
        id: "draft-1",
        total: 100,
        payer: "you",
        category: "Food",
        note: "Dinner with friends",
        participants: [{ id: "you", amount: 100 }],
      };

      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
          draft={draft}
        />
      );

      // Wait for draft to load
      await waitFor(() => {
        const noteTextarea = screen.getByLabelText(/note/i);
        expect(noteTextarea).toHaveValue("Dinner with friends");
      });
    });

    it("loads draft participants when provided", async () => {
      const draft: {
        id: string;
        total: number;
        payer: string;
        category: string;
        note: string;
        participants: { id: string; amount: number }[];
      } = {
        id: "draft-1",
        total: 150,
        payer: "you",
        category: "Food",
        note: "",

        participants: [
          { id: "you", amount: 50 },
          { id: "friend1", amount: 100 },
        ],
      };

      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
          draft={draft}
        />
      );

      // Alice should be loaded as a participant
      await waitFor(() => {
        const aliceShare = screen.getAllByText(/alice's share/i)[0];
        expect(aliceShare).toBeInTheDocument();
      });
    });
  });

  describe("Form submission", () => {
    it("calls onSplit with transaction data on valid submission", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      // Fill in bill amount
      const billInput = screen.getByLabelText(/bill amount/i);
      await user.type(billInput, "100");

      // Add a friend participant so submission is valid
      const comboboxes = screen.getAllByRole("combobox");
      const addFriendSelect = comboboxes.find((cb) => {
        const options = within(cb).queryAllByRole("option");
        return options.some((opt: HTMLElement) =>
          opt.textContent?.includes("Alice")
        );
      });
      await user.selectOptions(addFriendSelect!, "friend1");

      // Fill in participant amount for "You"
      const yourShareInput = screen.getByLabelText(/your share/i);
      await user.type(yourShareInput, "100");

      // Select category
      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, "Food");

      // Submit - get the submit button by its text content exactly
      const submitButton = screen.getByText("Save split", {
        selector: "button[type='submit']",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSplit).toHaveBeenCalled();
      });
    });

    it("clears form after successful submission", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      const billInput = screen.getByLabelText(/bill amount/i);
      await user.type(billInput, "100");

      // Add a friend participant so submission is valid
      const comboboxes = screen.getAllByRole("combobox");
      const addFriendSelect = comboboxes.find((cb) => {
        const options = within(cb).queryAllByRole("option");
        return options.some((opt: HTMLElement) =>
          opt.textContent?.includes("Alice")
        );
      });
      await user.selectOptions(addFriendSelect!, "friend1");

      const yourShareInput = screen.getByLabelText(/your share/i);
      await user.type(yourShareInput, "100");

      const submitButton = screen.getByText("Save split", {
        selector: "button[type='submit']",
      });
      await user.click(submitButton);

      // Wait for onSplit to be called
      await waitFor(() => {
        expect(mockOnSplit).toHaveBeenCalled();
      });

      // Check that form inputs are cleared/reset
      await waitFor(() => {
        expect(billInput).toHaveValue(null);
      });
    });

    it("includes selected category in submission", async () => {
      const user = userEvent.setup();
      render(
        <SplitForm
          friends={mockFriends}
          onSplit={mockOnSplit}
          onAutomation={mockOnAutomation}
          onRequestTemplate={mockOnRequestTemplate}
        />
      );

      const billInput = screen.getByLabelText(/bill amount/i);
      await user.type(billInput, "100");

      // Add a friend participant so submission is valid
      const comboboxes = screen.getAllByRole("combobox");
      const addFriendSelect = comboboxes.find((cb) => {
        const options = within(cb).queryAllByRole("option");
        return options.some((opt: HTMLElement) =>
          opt.textContent?.includes("Alice")
        );
      });
      await user.selectOptions(addFriendSelect!, "friend1");

      const yourShareInput = screen.getByLabelText(/your share/i);
      await user.type(yourShareInput, "100");

      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, "Transport");

      const submitButton = screen.getByText("Save split", {
        selector: "button[type='submit']",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSplit).toHaveBeenCalled();
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const callArg = mockOnSplit.mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      expect(callArg).toHaveProperty("category", "Transport");
    });
  });
});
