import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettlementAssistantModal from "../SettlementAssistantModal";

const friend = { 
  id: "friend-1", 
  name: "Taylor",
  active: true,
  createdAt: Date.now()
};

afterEach(() => {
  cleanup();
});

describe("SettlementAssistantModal", () => {
  it("submits an initiated settlement with metadata", async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <SettlementAssistantModal
        friend={friend}
        balance={48.5}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const methodInput = await screen.findByLabelText(/payment method/i);
    await waitFor(() => expect(document.activeElement).toBe(methodInput));

    await user.type(methodInput, "Bank transfer");
    const amountInput = screen.getByLabelText(/amount to record/i);
    await user.clear(amountInput);
    await user.type(amountInput, "48.5");
    const dueInput = screen.getByLabelText(/due date/i);
    await user.type(dueInput, "2025-02-10");
    const referenceInput = screen.getByLabelText(/payment reference/i);
    await user.type(referenceInput, "INV-2025-02");
    const notesInput = screen.getByLabelText(/notes/i);
    await user.type(notesInput, "Transfer via IBAN");

    await user.click(screen.getByRole("button", { name: /save settlement/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      amount: 48.5,
      status: "initiated",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      payment: expect.objectContaining({
        method: "Bank transfer",
        dueDate: "2025-02-10",
        memo: "Transfer via IBAN",
        reference: "INV-2025-02",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        dueDateLabel: expect.any(String),
      }),
    });
  });

  it("records a confirmed settlement when marked as paid", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <SettlementAssistantModal
        friend={friend}
        balance={-25}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await screen.findByLabelText(/amount to record/i);
    const checkbox = screen.getByLabelText(/mark as paid now/i, {
      selector: "input",
    });
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: /save settlement/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      amount: -25,
      status: "confirmed",
      payment: null,
    });
  });

  it("keeps focus trapped inside the modal", async () => {
    const user = userEvent.setup();

    render(
      <SettlementAssistantModal
        friend={friend}
        balance={30}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const methodInput = await screen.findByLabelText(/payment method/i);
    await waitFor(() => expect(document.activeElement).toBe(methodInput));

    await user.tab({ shift: true });
    const closeButton = screen.getByRole("button", { name: /close modal/i });
    expect(document.activeElement).toBe(closeButton);

    await user.tab();
    expect(document.activeElement).toBe(methodInput);
  });
});
