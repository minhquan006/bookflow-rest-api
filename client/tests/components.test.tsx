import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormField } from "../src/components/FormField";
import { Pagination } from "../src/components/Pagination";

describe("shared accessible controls", () => {
  it("connects a field's label and validation message", () => {
    render(
      <FormField label="Email" type="email" error="Enter a valid email." />,
    );
    const field = screen.getByLabelText("Email");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Enter a valid email.");
  });

  it("enforces pagination bounds and reports the selected page", async () => {
    const change = vi.fn();
    const { rerender } = render(
      <Pagination page={1} totalPages={3} onPageChange={change} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(change).toHaveBeenCalledWith(2);
    rerender(<Pagination page={3} totalPages={3} onPageChange={change} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
  });

  it("blocks paging during a pending request and hides empty pagination", () => {
    const { rerender } = render(
      <Pagination page={2} totalPages={3} busy onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    rerender(<Pagination page={1} totalPages={0} onPageChange={vi.fn()} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
