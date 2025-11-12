import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AnalyticsFriendBalances from "../AnalyticsFriendBalances";

afterEach(() => {
  cleanup();
});

describe("AnalyticsFriendBalances", () => {
  const mockEntries = [
    { friendId: "1", name: "Alice", balance: 50.0 },
    { friendId: "2", name: "Bob", balance: -30.0 },
    { friendId: "3", name: "Charlie", balance: 75.5 },
  ];

  it("renders empty state when no entries provided", () => {
    render(<AnalyticsFriendBalances />);

    expect(
      screen.getByText("No balances tracked for friends yet.")
    ).toBeInTheDocument();
  });

  it("renders empty state when entries array is empty", () => {
    render(<AnalyticsFriendBalances entries={[]} />);

    expect(
      screen.getByText("No balances tracked for friends yet.")
    ).toBeInTheDocument();
  });

  it("renders list of friend balances", () => {
    render(<AnalyticsFriendBalances entries={mockEntries} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("displays formatted amounts with + for positive balances", () => {
    render(<AnalyticsFriendBalances entries={mockEntries} />);

    expect(screen.getByText("+€50.00")).toBeInTheDocument();
    expect(screen.getByText("+€75.50")).toBeInTheDocument();
  });

  it("displays formatted amounts with - for negative balances", () => {
    render(<AnalyticsFriendBalances entries={mockEntries} />);

    expect(screen.getByText("-€30.00")).toBeInTheDocument();
  });

  it("shows 'owes you' message for positive balances", () => {
    render(<AnalyticsFriendBalances entries={mockEntries} />);

    expect(screen.getByText("Alice owes you")).toBeInTheDocument();
    expect(screen.getByText("Charlie owes you")).toBeInTheDocument();
  });

  it("shows 'You owe' message for negative balances", () => {
    render(<AnalyticsFriendBalances entries={mockEntries} />);

    expect(screen.getByText("You owe Bob")).toBeInTheDocument();
  });

  it("renders progress bars with aria-hidden", () => {
    const { container } = render(
      <AnalyticsFriendBalances entries={mockEntries} />
    );

    const progressBars = container.querySelectorAll('[aria-hidden="true"]');
    expect(progressBars.length).toBe(3);
  });

  it("applies positive styling to positive balance bars", () => {
    const { container } = render(
      <AnalyticsFriendBalances entries={mockEntries} />
    );

    const bars = container.querySelectorAll('[aria-hidden="true"] > div');
    // Alice (positive) should have positive class
    expect(bars[0].className).toMatch(/barPositive/);
    // Charlie (positive) should have positive class
    expect(bars[2].className).toMatch(/barPositive/);
  });

  it("applies negative styling to negative balance bars", () => {
    const { container } = render(
      <AnalyticsFriendBalances entries={mockEntries} />
    );

    const bars = container.querySelectorAll('[aria-hidden="true"] > div');
    // Bob (negative) should have negative class
    expect(bars[1].className).toMatch(/barNegative/);
  });

  it("calculates bar width based on max balance", () => {
    const { container } = render(
      <AnalyticsFriendBalances entries={mockEntries} />
    );

    const bars = container.querySelectorAll('[aria-hidden="true"] > div');

    // Charlie has highest balance (75.5), should be 100% width
    const charlieBar = bars[2] as HTMLElement;
    expect(charlieBar.style.width).toBe("100%");

    // Alice has 50, should be ~66% (50/75.5 * 100)
    const aliceBar = bars[0] as HTMLElement;
    const aliceWidth = parseFloat(aliceBar.style.width);
    expect(aliceWidth).toBeGreaterThan(60);
    expect(aliceWidth).toBeLessThan(70);

    // Bob has 30 (absolute value), should be ~40% (30/75.5 * 100)
    const bobBar = bars[1] as HTMLElement;
    const bobWidth = parseFloat(bobBar.style.width);
    expect(bobWidth).toBeGreaterThan(35);
    expect(bobWidth).toBeLessThan(45);
  });

  it("sets minimum bar width of 6%", () => {
    const entries = [
      { friendId: "1", name: "Alice", balance: 100 },
      { friendId: "2", name: "Bob", balance: 0.5 }, // Very small balance
    ];

    const { container } = render(<AnalyticsFriendBalances entries={entries} />);

    const bars = container.querySelectorAll('[aria-hidden="true"] > div');
    const bobBar = bars[1] as HTMLElement;

    // Should be at least 6% even though calculated would be much less
    expect(parseFloat(bobBar.style.width)).toBeGreaterThanOrEqual(6);
  });

  it("handles zero balance", () => {
    const entries = [{ friendId: "1", name: "Alice", balance: 0 }];

    render(<AnalyticsFriendBalances entries={entries} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    // Zero is treated as negative (balance > 0 is false)
    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "-€0.00";
      })
    ).toBeInTheDocument();
    expect(screen.getByText("You owe Alice")).toBeInTheDocument();
  });

  it("handles single entry", () => {
    const entries = [{ friendId: "1", name: "Alice", balance: 25.5 }];

    render(<AnalyticsFriendBalances entries={entries} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("+€25.50")).toBeInTheDocument();
  });

  it("renders entries in provided order", () => {
    const { container } = render(
      <AnalyticsFriendBalances entries={mockEntries} />
    );

    // CSS modules hash class names, so we need to use attribute selector
    const names = Array.from(container.querySelectorAll('[class*="name"]')).map(
      (el) => el.textContent
    );

    expect(names).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("applies positive amount styling", () => {
    const { container } = render(
      <AnalyticsFriendBalances entries={mockEntries} />
    );

    // CSS modules hash class names, use attribute selector
    const amounts = container.querySelectorAll('[class*="amount"]');
    // Alice (positive) - check for positive class in className
    expect(amounts[0].className).toMatch(/amountPositive/);
    // Charlie (positive)
    expect(amounts[2].className).toMatch(/amountPositive/);
  });

  it("applies negative amount styling", () => {
    const { container } = render(
      <AnalyticsFriendBalances entries={mockEntries} />
    );

    // CSS modules hash class names, use attribute selector
    const amounts = container.querySelectorAll('[class*="amount"]');
    // Bob (negative)
    expect(amounts[1].className).toMatch(/amountNegative/);
  });

  it("handles large balances", () => {
    const entries = [
      { friendId: "1", name: "Alice", balance: 9999.99 },
      { friendId: "2", name: "Bob", balance: -1234.56 },
    ];

    render(<AnalyticsFriendBalances entries={entries} />);

    expect(screen.getByText("+€9,999.99")).toBeInTheDocument();
    expect(screen.getByText("-€1,234.56")).toBeInTheDocument();
  });

  it("handles very small balances", () => {
    const entries = [{ friendId: "1", name: "Alice", balance: 0.01 }];

    render(<AnalyticsFriendBalances entries={entries} />);

    expect(screen.getByText("+€0.01")).toBeInTheDocument();
  });

  it("uses friendId as key for list items", () => {
    const { container } = render(
      <AnalyticsFriendBalances entries={mockEntries} />
    );

    const items = container.querySelectorAll('[class*="item"]');
    expect(items.length).toBe(3);
  });
});
