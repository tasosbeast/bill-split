import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AnalyticsNetBalanceChart from "../AnalyticsNetBalanceChart";

afterEach(() => {
  cleanup();
});

describe("AnalyticsNetBalanceChart", () => {
  it("renders empty state when both values are zero", () => {
    render(<AnalyticsNetBalanceChart owedToYou={0} youOwe={0} />);

    expect(screen.getByText("No outstanding balances.")).toBeInTheDocument();
  });

  it("renders empty state with presentation role", () => {
    const { container } = render(
      <AnalyticsNetBalanceChart owedToYou={0} youOwe={0} />
    );

    const emptyDiv = container.querySelector('[role="presentation"]');
    expect(emptyDiv).toBeInTheDocument();
  });

  it("renders chart when owedToYou is positive", () => {
    render(<AnalyticsNetBalanceChart owedToYou={100} youOwe={0} />);

    expect(screen.getByText("Owed to you")).toBeInTheDocument();
    expect(screen.getByText("€100.00")).toBeInTheDocument();
  });

  it("renders chart when youOwe is positive", () => {
    render(<AnalyticsNetBalanceChart owedToYou={0} youOwe={50} />);

    expect(screen.getByText("You owe")).toBeInTheDocument();
    expect(screen.getByText("€50.00")).toBeInTheDocument();
  });

  it("renders both values when both are positive", () => {
    render(<AnalyticsNetBalanceChart owedToYou={100} youOwe={50} />);

    expect(screen.getByText("Owed to you")).toBeInTheDocument();
    expect(screen.getByText("€100.00")).toBeInTheDocument();
    expect(screen.getByText("You owe")).toBeInTheDocument();
    expect(screen.getByText("€50.00")).toBeInTheDocument();
  });

  it("renders accessible aria-label with balance composition", () => {
    render(<AnalyticsNetBalanceChart owedToYou={75.5} youOwe={25.25} />);

    const chart = screen.getByRole("img");
    expect(chart).toHaveAttribute(
      "aria-label",
      "Balance composition: owed to you €75.50, you owe €25.25."
    );
  });

  it("uses definition list for legend semantics", () => {
    const { container } = render(
      <AnalyticsNetBalanceChart owedToYou={100} youOwe={50} />
    );

    const dl = container.querySelector("dl");
    expect(dl).toBeInTheDocument();

    const dts = container.querySelectorAll("dt");
    expect(dts.length).toBe(2);
    expect(dts[0].textContent).toBe("Owed to you");
    expect(dts[1].textContent).toBe("You owe");

    const dds = container.querySelectorAll("dd");
    expect(dds.length).toBe(2);
    expect(dds[0].textContent).toBe("€100.00");
    expect(dds[1].textContent).toBe("€50.00");
  });

  it("sets bar track with aria-hidden", () => {
    const { container } = render(
      <AnalyticsNetBalanceChart owedToYou={100} youOwe={50} />
    );

    const barTrack = container.querySelector('[aria-hidden="true"]');
    expect(barTrack).toBeInTheDocument();
  });

  it("sets positive bar flexGrow based on owedToYou value", () => {
    const { container } = render(
      <AnalyticsNetBalanceChart owedToYou={75} youOwe={25} />
    );

    const bars = container.querySelectorAll('[aria-hidden="true"] > div');
    const positiveBar = bars[0] as HTMLElement;

    expect(positiveBar.style.flexGrow).toBe("75");
  });

  it("sets negative bar flexGrow based on youOwe value", () => {
    const { container } = render(
      <AnalyticsNetBalanceChart owedToYou={75} youOwe={25} />
    );

    const bars = container.querySelectorAll('[aria-hidden="true"] > div');
    const negativeBar = bars[1] as HTMLElement;

    expect(negativeBar.style.flexGrow).toBe("25");
  });

  it("handles decimal values correctly", () => {
    render(<AnalyticsNetBalanceChart owedToYou={123.45} youOwe={67.89} />);

    expect(screen.getByText("€123.45")).toBeInTheDocument();
    expect(screen.getByText("€67.89")).toBeInTheDocument();
  });

  it("formats large numbers with thousands separators", () => {
    render(<AnalyticsNetBalanceChart owedToYou={1234.56} youOwe={9876.54} />);

    expect(screen.getByText("€1,234.56")).toBeInTheDocument();
    expect(screen.getByText("€9,876.54")).toBeInTheDocument();
  });

  it("treats negative input values as zero", () => {
    // Component uses Math.max(0, value) to ensure non-negative
    render(<AnalyticsNetBalanceChart owedToYou={-50} youOwe={-30} />);

    // Both negative values become zero, so should show empty state
    expect(screen.getByText("No outstanding balances.")).toBeInTheDocument();
  });

  it("handles one negative value correctly", () => {
    render(<AnalyticsNetBalanceChart owedToYou={100} youOwe={-50} />);

    // youOwe becomes 0, only owedToYou shows
    expect(screen.getByText("€100.00")).toBeInTheDocument();
    expect(screen.getByText("€0.00")).toBeInTheDocument();
  });

  it("renders role='img' on chart wrapper", () => {
    render(<AnalyticsNetBalanceChart owedToYou={100} youOwe={50} />);

    const chart = screen.getByRole("img");
    expect(chart).toBeInTheDocument();
  });

  it("displays zeros when one value is zero", () => {
    render(<AnalyticsNetBalanceChart owedToYou={100} youOwe={0} />);

    expect(screen.getByText("€100.00")).toBeInTheDocument();
    expect(screen.getByText("€0.00")).toBeInTheDocument();
  });

  it("applies CSS module classes", () => {
    const { container } = render(
      <AnalyticsNetBalanceChart owedToYou={100} youOwe={50} />
    );

    // Check that CSS modules are applied (classes are hashed)
    expect(container.querySelector('[class*="wrapper"]')).toBeInTheDocument();
    expect(container.querySelector('[class*="barTrack"]')).toBeInTheDocument();
    expect(container.querySelector('[class*="legend"]')).toBeInTheDocument();
  });

  it("renders both bars even when one value is zero", () => {
    const { container } = render(
      <AnalyticsNetBalanceChart owedToYou={100} youOwe={0} />
    );

    const bars = container.querySelectorAll('[aria-hidden="true"] > div');
    expect(bars.length).toBe(2);

    // First bar (positive) should have flexGrow 100
    expect((bars[0] as HTMLElement).style.flexGrow).toBe("100");
    // Second bar (negative) should have flexGrow 0
    expect((bars[1] as HTMLElement).style.flexGrow).toBe("0");
  });
});
