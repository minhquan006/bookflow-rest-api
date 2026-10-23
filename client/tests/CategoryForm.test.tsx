import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategoryForm } from "../src/features/catalog/CategoryForm";

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole("textbox", { name: "Category name" }),
    "Science Fiction",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Slug" }),
    "science-fiction",
  );
}

describe("Category creation form", () => {
  it("submits category data and clears fields after success", async () => {
    const onCreate = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    render(<CategoryForm onCreate={onCreate} />);

    await fillForm(user);
    await user.click(
      screen.getByRole("button", {
        name: "Create category",
      }),
    );

    expect(
      await screen.findByText("Category created successfully."),
    ).toBeInTheDocument();

    expect(onCreate).toHaveBeenCalledExactlyOnceWith({
      name: "Science Fiction",
      slug: "science-fiction",
    });
    expect(
      screen.getByRole("textbox", {
        name: "Category name",
      }),
    ).toHaveValue("");
    expect(
      screen.getByRole("textbox", {
        name: "Slug",
      }),
    ).toHaveValue("");
  });

  it("preserves input after an API error and permits retry", async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error("This category already exists."))
      .mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<CategoryForm onCreate={onCreate} />);

    await fillForm(user);
    await user.click(
      screen.getByRole("button", {
        name: "Create category",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This category already exists.",
    );
    expect(
      screen.getByRole("textbox", {
        name: "Category name",
      }),
    ).toHaveValue("Science Fiction");
    expect(
      screen.getByRole("textbox", {
        name: "Slug",
      }),
    ).toHaveValue("science-fiction");

    await user.click(
      screen.getByRole("button", {
        name: "Create category",
      }),
    );

    expect(
      await screen.findByText("Category created successfully."),
    ).toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables submission and fields while a request is pending", async () => {
    let complete!: () => void;
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const onCreate = vi.fn().mockReturnValue(pending);
    const user = userEvent.setup();
    render(<CategoryForm onCreate={onCreate} />);

    await fillForm(user);
    const button = screen.getByRole("button", {
      name: "Create category",
    });
    await user.dblClick(button);

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(
      screen.getByRole("textbox", {
        name: "Category name",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("textbox", {
        name: "Slug",
      }),
    ).toBeDisabled();

    await act(async () => {
      complete();
      await pending;
    });

    expect(
      await screen.findByText("Category created successfully."),
    ).toBeInTheDocument();
    expect(button).toBeEnabled();
  });
});
