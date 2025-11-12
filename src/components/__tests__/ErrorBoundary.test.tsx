import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";
import * as Sentry from "@sentry/react";

// Mock Sentry
vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
}));

// Component that throws an error
function ThrowError({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Normal content</div>;
}

// Suppress console.error in tests since we're intentionally throwing errors
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  console.error = originalError;
});

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders default fallback UI when an error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Something went wrong. Please reload.")
    ).toBeInTheDocument();
  });

  it("renders custom fallback UI when provided", () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error message")).toBeInTheDocument();
    expect(
      screen.queryByText("Something went wrong. Please reload.")
    ).not.toBeInTheDocument();
  });

  it("calls Sentry.captureException when an error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it("default fallback has proper ARIA attributes", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const fallback = screen.getByRole("alert");
    expect(fallback).toHaveClass("error-fallback");
    expect(fallback).toHaveAttribute("aria-live", "assertive");
  });

  it("continues to show error state after initial error", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(
      screen.getByText("Something went wrong. Please reload.")
    ).toBeInTheDocument();

    // Rerender - error state should persist
    rerender(
      <ErrorBoundary>
        <div>New content</div>
      </ErrorBoundary>
    );

    // Should still show error fallback, not new content
    expect(
      screen.getByText("Something went wrong. Please reload.")
    ).toBeInTheDocument();
    expect(screen.queryByText("New content")).not.toBeInTheDocument();
  });

  it("handles errors in nested components", () => {
    render(
      <ErrorBoundary>
        <div>
          <div>
            <ThrowError shouldThrow={true} />
          </div>
        </div>
      </ErrorBoundary>
    );

    expect(
      screen.getByText("Something went wrong. Please reload.")
    ).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("does not interfere with children when no error occurs", () => {
    const onClickMock = vi.fn();

    render(
      <ErrorBoundary>
        <button onClick={onClickMock}>Click me</button>
      </ErrorBoundary>
    );

    const button = screen.getByRole("button", { name: "Click me" });
    button.click();

    expect(onClickMock).toHaveBeenCalledTimes(1);
  });
});
