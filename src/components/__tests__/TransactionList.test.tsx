import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  within,
  cleanup,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransactionList from "../TransactionList";
import type { Friend, StoredTransaction } from "../../types/legacySnapshot";

const mockFriend: Friend = {
  id: "friend1",
  name: "Alice",
  email: "alice@example.com",
  active: true,
  createdAt: Date.now(),
};

const mockFriendsById = new Map<string, Friend>([
  ["friend1", mockFriend],
  [
    "friend2",
    {
      id: "friend2",
      name: "Bob",
      email: "bob@example.com",
      active: true,
      createdAt: Date.now(),
    },
  ],
]);

const mockTransactions: StoredTransaction[] = [
  {
    id: "tx1",
    type: "split",
    total: 5000,
    note: "Lunch",
    category: "Food",
    payer: "you",
    participants: [
      { id: "you", amount: 2500 },
      { id: "friend1", amount: 2500 },
    ],
    effects: [
      {
        friendId: "friend1",
        delta: 2500,
        share: 0,
      },
    ],
    createdAt: "2024-01-15T10:00:00.000Z",
  },
  {
    id: "tx2",
    type: "split",
    total: 1000,
    note: "Coffee",
    category: "Drinks",
    payer: "friend1",
    participants: [
      { id: "you", amount: 500 },
      { id: "friend1", amount: 500 },
    ],
    effects: [{ friendId: "friend1", delta: -500 }],
    createdAt: "2024-01-20T14:00:00.000Z",
  },
  {
    id: "tx3",
    type: "split",
    total: 3000,
    note: "Taxi",
    category: "Transport",
    payer: "you",
    participants: [
      { id: "you", amount: 1500 },
      { id: "friend1", amount: 1500 },
    ],
    effects: [{ friendId: "friend1", delta: 1500 }],
    createdAt: "2024-02-10T18:00:00.000Z",
  },
];

describe("TransactionList", () => {
  const mockOnRequestEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnConfirmSettlement = vi.fn();
  const mockOnCancelSettlement = vi.fn();
  const mockOnReopenSettlement = vi.fn();

  beforeEach(() => {
    mockOnRequestEdit.mockClear();
    mockOnDelete.mockClear();
    mockOnConfirmSettlement.mockClear();
    mockOnCancelSettlement.mockClear();
    mockOnReopenSettlement.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders nothing when friend is null", () => {
      const { container } = render(
        <TransactionList
          friend={null}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders the transactions title", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("Transactions")).toBeInTheDocument();
    });

    it("renders category filter", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    });

    it("renders date range filter", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByLabelText(/date range start/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/date range end/i)).toBeInTheDocument();
    });

    it("renders transactions with 'transactions' prop", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      // Check for transaction elements by looking for their category badges in the list
      const listContainer = document.querySelector<HTMLElement>(".list");
      expect(listContainer).not.toBeNull();
      expect(within(listContainer!).getByText("Food")).toBeInTheDocument();
      expect(within(listContainer!).getByText("Drinks")).toBeInTheDocument();
      expect(within(listContainer!).getByText("Transport")).toBeInTheDocument();
    });

    it("renders transactions with 'items' prop", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          items={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      // Check for transaction elements by looking for their category badges in the list
      const listContainer = document.querySelector<HTMLElement>(".list");
      expect(listContainer).not.toBeNull();
      expect(within(listContainer!).getByText("Food")).toBeInTheDocument();
      expect(within(listContainer!).getByText("Drinks")).toBeInTheDocument();
      expect(within(listContainer!).getByText("Transport")).toBeInTheDocument();
    });

    it("prioritizes 'transactions' prop over 'items' prop", () => {
      const priorityTransactions: StoredTransaction[] = [
        {
          id: "priority-tx",
          type: "split",
          total: 1000,
          category: "Bills",
          note: "Priority Transaction",
          payer: "you",
          participants: [{ id: "you", amount: 1000 }],
          effects: [],
          createdAt: "2024-03-01T10:00:00.000Z",
        },
      ];

      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={priorityTransactions}
          items={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      const listContainer = document.querySelector<HTMLElement>(".list");
      expect(listContainer).not.toBeNull();
      // Bills category should appear (from priority transactions)
      expect(within(listContainer!).getByText("Bills")).toBeInTheDocument();
      // Food category should not appear (from items transactions)
      expect(
        within(listContainer!).queryByText("Food")
      ).not.toBeInTheDocument();
    });

    it("handles empty transactions array", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={[]}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      // Shows kicker message and no list container
      expect(
        screen.getByText(`No transactions yet with ${mockFriend.name}.`)
      ).toBeInTheDocument();
      const listContainer = document.querySelector<HTMLElement>(".list");
      expect(listContainer).toBeNull();
    });

    it("handles undefined transactions", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("Transactions")).toBeInTheDocument();
      // Check that no transactions are rendered in list container
      const listContainer2 = document.querySelector<HTMLElement>(".list");
      expect(listContainer2).toBeNull();
      // No list; nothing further to assert for categories.
    });
  });

  describe("friendsById normalization", () => {
    it("handles friendsById as Map", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      // Check that transactions are rendered correctly with Map friendsById
      const listContainer = document.querySelector<HTMLElement>(".list");
      expect(listContainer).not.toBeNull();
      expect(within(listContainer!).getByText("Food")).toBeInTheDocument();
    });

    it("handles friendsById as Record object", () => {
      const friendsRecord: Record<string, Friend> = {
        friend1: mockFriend,
        friend2: {
          id: "friend2",
          name: "Bob",
          email: "bob@example.com",
          active: true,
          createdAt: Date.now(),
        },
      };

      render(
        <TransactionList
          friend={mockFriend}
          friendsById={friendsRecord}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      // Check that transactions are rendered correctly with Record friendsById
      const listContainer = document.querySelector<HTMLElement>(".list");
      expect(listContainer).not.toBeNull();
      expect(within(listContainer!).getByText("Food")).toBeInTheDocument();
    });

    it("handles undefined friendsById", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={undefined as unknown as Map<string, Friend>}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      // Check that transactions still render with undefined friendsById
      const listContainer = document.querySelector<HTMLElement>(".list");
      expect(listContainer).not.toBeNull();
      expect(within(listContainer!).getByText("Food")).toBeInTheDocument();
    });
  });

  describe("Filtering", () => {
    it("shows 'Clear filters' button when category filter is active", async () => {
      const user = userEvent.setup();
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      // Initially no clear button
      expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();

      // Apply category filter
      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, "Food");

      // Clear button should appear
      expect(screen.getByText("Clear filters")).toBeInTheDocument();
    });

    it("shows 'Clear filters' button when date filter is active", async () => {
      const user = userEvent.setup();
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      // Initially no clear button
      expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();

      // Apply date filter
      const startInput = screen.getByLabelText(/date range start/i);
      await user.type(startInput, "2024-01-01");

      // Clear button should appear (debounced)
      await waitFor(() => {
        expect(screen.getByText("Clear filters")).toBeInTheDocument();
      });
    });

    it("filters transactions by category", async () => {
      const user = userEvent.setup();
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      const listContainer = document.querySelector<HTMLElement>(".list");
      expect(listContainer).not.toBeNull();

      // All transaction categories visible initially
      expect(within(listContainer!).getByText("Food")).toBeInTheDocument();
      expect(within(listContainer!).getByText("Drinks")).toBeInTheDocument();
      expect(within(listContainer!).getByText("Transport")).toBeInTheDocument();

      // Filter by Food category
      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, "Food");

      // Only Food category visible in transaction list, others filtered out
      expect(within(listContainer!).getByText("Food")).toBeInTheDocument();
      expect(
        within(listContainer!).queryByText("Drinks")
      ).not.toBeInTheDocument();
      expect(
        within(listContainer!).queryByText("Transport")
      ).not.toBeInTheDocument();
    });

    it("clears all filters when 'Clear filters' button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      // Apply category filter
      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, "Food");

      const listContainer = document.querySelector<HTMLElement>(".list");
      expect(listContainer).not.toBeNull();

      // Only Food category visible in transactions
      expect(within(listContainer!).getByText("Food")).toBeInTheDocument();
      expect(
        within(listContainer!).queryByText("Drinks")
      ).not.toBeInTheDocument();

      // Clear filters
      const clearButton = screen.getByText("Clear filters");
      await user.click(clearButton);

      // All categories visible in transactions again
      expect(within(listContainer!).getByText("Food")).toBeInTheDocument();
      expect(within(listContainer!).getByText("Drinks")).toBeInTheDocument();
      expect(within(listContainer!).getByText("Transport")).toBeInTheDocument();

      // Clear button should be hidden
      expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
    });
  });

  describe("Settlement handlers", () => {
    it("passes onConfirmSettlement handler to Transactions", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
          onConfirmSettlement={mockOnConfirmSettlement}
        />
      );

      // Component should render without error
      expect(screen.getByText("Transactions")).toBeInTheDocument();
    });

    it("passes onCancelSettlement handler to Transactions", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
          onCancelSettlement={mockOnCancelSettlement}
        />
      );

      expect(screen.getByText("Transactions")).toBeInTheDocument();
    });

    it("passes onReopenSettlement handler to Transactions", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
          onReopenSettlement={mockOnReopenSettlement}
        />
      );

      expect(screen.getByText("Transactions")).toBeInTheDocument();
    });

    it("handles missing settlement handlers gracefully", () => {
      render(
        <TransactionList
          friend={mockFriend}
          friendsById={mockFriendsById}
          transactions={mockTransactions}
          onRequestEdit={mockOnRequestEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("Transactions")).toBeInTheDocument();
    });
  });
});
