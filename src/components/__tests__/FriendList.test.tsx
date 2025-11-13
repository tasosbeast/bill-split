import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FriendList from "../FriendList";
import type { Friend } from "../../types/legacySnapshot";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FriendList", () => {
  const mockOnSelect = vi.fn();
  const mockOnRemove = vi.fn();

  const mockFriends: Friend[] = [
    {
      id: "1",
      name: "Alice",
      email: "alice@example.com",
      tag: "friend",
      active: true,
      createdAt: Date.now(),
    },
    {
      id: "2",
      name: "Bob",
      email: "bob@example.com",
      tag: "roommate",
      active: true,
      createdAt: Date.now(),
    },
    {
      id: "3",
      name: "Charlie",
      email: "charlie@example.com",
      tag: "friend",
      active: true,
      createdAt: Date.now(),
    },
  ];

  beforeEach(() => {
    mockOnSelect.mockClear();
    mockOnRemove.mockClear();
  });

  it("renders empty state when no friends exist", () => {
    render(
      <FriendList
        friends={[]}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    expect(
      screen.getByText("No friends yet. Add one to get started.")
    ).toBeInTheDocument();
  });

  it("renders list of friends with names and emails", () => {
    render(
      <FriendList
        friends={mockFriends}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("charlie@example.com")).toBeInTheDocument();
  });

  it("displays friend tags", () => {
    render(
      <FriendList
        friends={mockFriends}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    const friendTags = screen.getAllByText("friend");
    expect(friendTags).toHaveLength(2); // Alice and Charlie
    expect(screen.getByText("roommate")).toBeInTheDocument(); // Bob
  });

  it("calls onSelect when friend is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FriendList
        friends={mockFriends}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    // Find the primary button via DOM structure (name appears in both buttons)
    const aliceListItem = screen.getByText("Alice").closest(".list-item");
    const aliceButton = aliceListItem?.querySelector(
      ".friend-list__primary"
    ) as HTMLElement;
    expect(aliceButton).toBeInTheDocument();
    await user.click(aliceButton);

    expect(mockOnSelect).toHaveBeenCalledWith("1");
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it("deselects friend when clicking selected friend", async () => {
    const user = userEvent.setup();
    render(
      <FriendList
        friends={mockFriends}
        selectedId="1"
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    const aliceListItem = screen.getByText("Alice").closest(".list-item");
    const aliceButton = aliceListItem?.querySelector(
      ".friend-list__primary"
    ) as HTMLElement;
    await user.click(aliceButton);

    expect(mockOnSelect).toHaveBeenCalledWith(null);
  });

  it("highlights selected friend with active class", () => {
    render(
      <FriendList
        friends={mockFriends}
        selectedId="2"
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    const bobListItem = screen.getByText("Bob").closest(".list-item");
    expect(bobListItem).toHaveClass("active");
  });

  it("sets aria-pressed on selected friend", () => {
    render(
      <FriendList
        friends={mockFriends}
        selectedId="1"
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    const aliceListItem = screen.getByText("Alice").closest(".list-item");
    const aliceButton = aliceListItem?.querySelector(
      ".friend-list__primary"
    ) as HTMLElement;
    expect(aliceButton).toHaveAttribute("aria-pressed", "true");

    const bobListItem = screen.getByText("Bob").closest(".list-item");
    const bobButton = bobListItem?.querySelector(
      ".friend-list__primary"
    ) as HTMLElement;
    expect(bobButton).toHaveAttribute("aria-pressed", "false");
  });

  it("allows removing friend with zero balance", async () => {
    const user = userEvent.setup();
    const balances = new Map([
      ["1", 0],
      ["2", 10],
      ["3", -5],
    ]);

    render(
      <FriendList
        friends={mockFriends}
        balances={balances}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
    const aliceRemoveButton = removeButtons.find((btn) =>
      btn.getAttribute("aria-label")?.includes("Alice")
    );

    expect(aliceRemoveButton).not.toBeDisabled();

    if (aliceRemoveButton) {
      await user.click(aliceRemoveButton);
      expect(mockOnRemove).toHaveBeenCalledWith("1");
    }
  });

  it("disables remove button for friends with non-zero balance", () => {
    const balances = new Map([
      ["1", 0],
      ["2", 10],
      ["3", -5],
    ]);

    render(
      <FriendList
        friends={mockFriends}
        balances={balances}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    const bobListItem = screen.getByText("Bob").closest(".list-item");
    const bobRemoveButton = bobListItem?.querySelector(
      ".friend-list__delete"
    ) as HTMLElement;

    const charlieListItem = screen.getByText("Charlie").closest(".list-item");
    const charlieRemoveButton = charlieListItem?.querySelector(
      ".friend-list__delete"
    ) as HTMLElement;

    expect(bobRemoveButton).toBeDisabled();
    expect(charlieRemoveButton).toBeDisabled();
  });

  it("shows appropriate title for remove button based on balance", () => {
    const balances = new Map([
      ["1", 0],
      ["2", 10],
    ]);

    render(
      <FriendList
        friends={mockFriends.slice(0, 2)}
        balances={balances}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    const aliceListItem = screen.getByText("Alice").closest(".list-item");
    const aliceRemoveButton = aliceListItem?.querySelector(
      ".friend-list__delete"
    ) as HTMLElement;

    const bobListItem = screen.getByText("Bob").closest(".list-item");
    const bobRemoveButton = bobListItem?.querySelector(
      ".friend-list__delete"
    ) as HTMLElement;

    expect(aliceRemoveButton).toHaveAttribute("title", "Remove Alice");
    expect(bobRemoveButton).toHaveAttribute(
      "title",
      "Settle the balance before removing this friend."
    );
  });

  it("treats tiny balances (<0.01) as removable", async () => {
    const user = userEvent.setup();
    const balances = new Map([
      ["1", 0.005], // Less than 0.01
      ["2", 0.015], // Greater than 0.01
    ]);

    render(
      <FriendList
        friends={mockFriends.slice(0, 2)}
        balances={balances}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    const aliceListItem = screen.getByText("Alice").closest(".list-item");
    const aliceRemoveButton = aliceListItem?.querySelector(
      ".friend-list__delete"
    ) as HTMLElement;

    const bobListItem = screen.getByText("Bob").closest(".list-item");
    const bobRemoveButton = bobListItem?.querySelector(
      ".friend-list__delete"
    ) as HTMLElement;

    expect(aliceRemoveButton).not.toBeDisabled();
    expect(bobRemoveButton).toBeDisabled();

    if (aliceRemoveButton) {
      await user.click(aliceRemoveButton);
      expect(mockOnRemove).toHaveBeenCalledWith("1");
    }
  });

  it("uses friendSummaries when provided instead of calculating balances", () => {
    const friendSummaries = [
      {
        friend: mockFriends[0],
        balance: 50, // High balance
        canRemove: true, // But override to allow removal
      },
    ];

    render(
      <FriendList
        friends={mockFriends}
        friendSummaries={friendSummaries}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    // Only Alice should be rendered (from friendSummaries)
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: /Remove Alice/i });
    expect(removeButton).not.toBeDisabled(); // canRemove overrides balance
  });

  it("handles missing balances map gracefully", () => {
    render(
      <FriendList
        friends={mockFriends}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    // Should render without crashing
    expect(screen.getByText("Alice")).toBeInTheDocument();

    // All remove buttons should be enabled (default balance of 0)
    const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
    removeButtons.forEach((button) => {
      expect(button).not.toBeDisabled();
    });
  });

  it("does not call onRemove when clicking disabled remove button", async () => {
    const user = userEvent.setup();
    const balances = new Map([["1", 50]]);

    render(
      <FriendList
        friends={[mockFriends[0]]}
        balances={balances}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    const removeButton = screen.getByRole("button", {
      name: /Settle the balance/i,
    });
    expect(removeButton).toBeDisabled();

    // Attempt to click disabled button
    await user.click(removeButton);

    expect(mockOnRemove).not.toHaveBeenCalled();
  });

  it("renders friends in the order provided", () => {
    render(
      <FriendList
        friends={mockFriends}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
      />
    );

    // Get all list items and check the order of friend names
    const listItems = screen.getAllByText("friend").map((tag) => {
      const listItem = tag.closest(".list-item");
      return listItem?.querySelector(".fw-600")?.textContent;
    });

    // Alice and Charlie both have "friend" tag in this order
    expect(listItems[0]).toBe("Alice");
    expect(listItems[1]).toBe("Charlie");

    // Also verify Bob (roommate) is present
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("roommate")).toBeInTheDocument();
  });
});
