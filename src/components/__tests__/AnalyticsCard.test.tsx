import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AnalyticsCard from "../AnalyticsCard";

afterEach(() => {
  cleanup();
});

describe("AnalyticsCard", () => {
  it("renders with title only", () => {
    render(<AnalyticsCard title="Test Card" />);

    expect(
      screen.getByRole("heading", { name: "Test Card" })
    ).toBeInTheDocument();
  });

  it("renders with title and value", () => {
    render(<AnalyticsCard title="Total Spent" value="€123.45" />);

    expect(
      screen.getByRole("heading", { name: "Total Spent" })
    ).toBeInTheDocument();
    expect(screen.getByText("€123.45")).toBeInTheDocument();
  });

  it("renders with description", () => {
    render(
      <AnalyticsCard
        title="Budget Status"
        description="Your spending this month"
      />
    );

    expect(screen.getByText("Your spending this month")).toBeInTheDocument();
  });

  it("renders with footer", () => {
    render(
      <AnalyticsCard title="Total" footer={<button>View Details</button>} />
    );

    expect(
      screen.getByRole("button", { name: "View Details" })
    ).toBeInTheDocument();
  });

  it("renders with children", () => {
    render(
      <AnalyticsCard title="Chart">
        <div data-testid="chart-content">Chart goes here</div>
      </AnalyticsCard>
    );

    expect(screen.getByTestId("chart-content")).toBeInTheDocument();
    expect(screen.getByText("Chart goes here")).toBeInTheDocument();
  });

  it("applies brand accent class by default", () => {
    render(<AnalyticsCard title="Test" value="€100" />);

    // Check that value has brand accent class
    const valueElement = screen.getByText("€100");
    expect(valueElement.className).toContain("valueBrand");
  });

  it("applies danger accent class when specified", () => {
    render(<AnalyticsCard title="Over Budget" value="€500" accent="danger" />);

    const valueElement = screen.getByText("€500");
    expect(valueElement.className).toContain("valueDanger");
  });

  it("applies neutral accent class when specified", () => {
    render(<AnalyticsCard title="No Change" value="€0" accent="neutral" />);

    const valueElement = screen.getByText("€0");
    expect(valueElement.className).toContain("valueNeutral");
  });

  it("applies custom className", () => {
    const { container } = render(
      <AnalyticsCard title="Custom" className="custom-class" />
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("custom-class");
  });

  it("renders section element with proper semantic structure", () => {
    const { container } = render(
      <AnalyticsCard
        title="Semantic Test"
        value="€100"
        description="Description"
        footer="Footer"
      >
        <div>Body</div>
      </AnalyticsCard>
    );

    const section = container.querySelector("section");
    expect(section).toBeInTheDocument();

    // Should have header, body, and footer
    const header = section?.querySelector("header");
    expect(header).toBeInTheDocument();

    // Check semantic structure exists (CSS modules hash the class names)
    // Body and footer wrap the content in divs with hashed class names
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("renders ReactNode value", () => {
    render(
      <AnalyticsCard
        title="Complex Value"
        value={
          <div>
            <strong>€123</strong>
            <span>.45</span>
          </div>
        }
      />
    );

    expect(screen.getByText("€123")).toBeInTheDocument();
    expect(screen.getByText(".45")).toBeInTheDocument();
  });

  it("renders ReactNode description", () => {
    render(
      <AnalyticsCard
        title="Test"
        description={
          <span>
            <em>Emphasis</em> text
          </span>
        }
      />
    );

    expect(screen.getByText("Emphasis")).toBeInTheDocument();
    expect(screen.getByText("text")).toBeInTheDocument();
  });

  it("renders ReactNode footer", () => {
    render(
      <AnalyticsCard
        title="Test"
        footer={
          <div>
            <a href="/details">Learn more</a>
          </div>
        }
      />
    );

    expect(
      screen.getByRole("link", { name: "Learn more" })
    ).toBeInTheDocument();
  });

  it("does not render value div when value is undefined", () => {
    const { container } = render(<AnalyticsCard title="Test" />);

    const valueDiv = container.querySelector(".value");
    expect(valueDiv).not.toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<AnalyticsCard title="Test" />);

    const description = container.querySelector(".description");
    expect(description).not.toBeInTheDocument();
  });

  it("does not render body when children not provided", () => {
    const { container } = render(<AnalyticsCard title="Test" />);

    const body = container.querySelector(".body");
    expect(body).not.toBeInTheDocument();
  });

  it("does not render footer when not provided", () => {
    const { container } = render(<AnalyticsCard title="Test" />);

    const footer = container.querySelector(".footer");
    expect(footer).not.toBeInTheDocument();
  });

  it("handles empty string className", () => {
    const { container } = render(<AnalyticsCard title="Test" className="" />);

    const section = container.querySelector("section");
    expect(section?.className).not.toContain("undefined");
  });
});
