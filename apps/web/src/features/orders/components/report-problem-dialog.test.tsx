import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "../../../lib/i18n.js";
import { ReportProblemDialog } from "./report-problem-dialog.js";

describe("Task 6.11 — ReportProblemDialog Component", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <ReportProblemDialog
        isOpen={false}
        isPending={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog with accessible attributes, snapshot notice, and all 4 reasons", () => {
    render(
      <ReportProblemDialog
        isOpen={true}
        isPending={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("report-problem-dialog")).toBeInTheDocument();
    expect(screen.getByText("Report a problem")).toBeInTheDocument();

    // AI grade snapshot notice
    expect(screen.getByTestId("dispute-snapshot-notice")).toBeInTheDocument();
    expect(
      screen.getByText(/original AI quality grading and listing snapshots will be preserved/i),
    ).toBeInTheDocument();

    // Reason select options: GRADE_LOWER_THAN_LISTED, QUANTITY_SHORT, SPOILED, OTHER
    const select = screen.getByTestId("dispute-reason-select");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Grade lower than listed")).toBeInTheDocument();
    expect(screen.getByText("Quantity is short")).toBeInTheDocument();
    expect(screen.getByText("Produce spoiled or damaged")).toBeInTheDocument();
    expect(screen.getByText("Other problem")).toBeInTheDocument();
  });

  it("submits selected reason and trimmed note", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <ReportProblemDialog
        isOpen={true}
        isPending={false}
        onSubmit={handleSubmit}
        onClose={vi.fn()}
      />,
    );

    // Select QUANTITY_SHORT
    await user.selectOptions(screen.getByTestId("dispute-reason-select"), "QUANTITY_SHORT");

    // Enter note
    const noteInput = screen.getByTestId("dispute-note-input");
    await user.type(noteInput, "Received 40kg instead of 50kg bag");

    // Click submit
    await user.click(screen.getByTestId("dispute-submit-button"));

    expect(handleSubmit).toHaveBeenCalledWith({
      reason: "QUANTITY_SHORT",
      note: "Received 40kg instead of 50kg bag",
    });
  });

  it("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <ReportProblemDialog
        isOpen={true}
        isPending={false}
        onSubmit={vi.fn()}
        onClose={handleClose}
      />,
    );

    await user.click(screen.getByTestId("dispute-cancel-button"));
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("displays server error message when provided", () => {
    render(
      <ReportProblemDialog
        isOpen={true}
        isPending={false}
        error="Dispute window has expired (must be within 24 hours of delivery)"
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const errorAlert = screen.getByTestId("dispute-error-message");
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent("Dispute window has expired");
  });
});
