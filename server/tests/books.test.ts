import { describe, expect, it, vi } from "vitest";
import { listBooksSchema } from "../src/modules/books/books.schema.js";
import { createBooksService } from "../src/modules/books/books.service.js";
import { parseInput } from "../src/middleware/validation.js";

describe("Books query validation", () => {
  it("uses public listing defaults", () => {
    expect(parseInput(listBooksSchema, {})).toEqual({
      page: 1,
      limit: 20,
      sort: "title",
      includeArchived: "false",
    });
  });

  it.each([
    { page: "0" },
    { limit: "101" },
    { categoryId: "invalid-uuid" },
    { sort: "title; DROP TABLE books" },
    { includeArchived: "yes" },
    { unexpected: "value" },
    { q: "a".repeat(201) },
  ])("rejects invalid query %j", (query) => {
    expect(() => parseInput(listBooksSchema, query)).toThrow();
  });

  it("accepts search, category and descending sort", () => {
    const result = parseInput(listBooksSchema, {
      q: "  Practical  ",
      categoryId: "a610c346-8377-4351-8038-311d7fc73c2f",
      sort: "-title",
      page: "2",
      limit: "5",
    });

    expect(result).toEqual({
      q: "Practical",
      categoryId: "a610c346-8377-4351-8038-311d7fc73c2f",
      sort: "-title",
      page: 2,
      limit: 5,
      includeArchived: "false",
    });
  });
});

describe("Books service", () => {
  it("blocks archived listing before querying the database", async () => {
    const repository = {
      count: vi.fn().mockResolvedValue(0),
      list: vi.fn().mockResolvedValue([]),
    };
    const service = createBooksService(repository);
    const input = parseInput(listBooksSchema, {
      includeArchived: "true",
    });

    await expect(service.list(input)).rejects.toThrow();
    expect(repository.count).not.toHaveBeenCalled();
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("returns an empty page while preserving the filtered total", async () => {
    const repository = {
      count: vi.fn().mockResolvedValue(3),
      list: vi.fn().mockResolvedValue([]),
    };
    const input = parseInput(listBooksSchema, {
      q: "Practical",
      page: "5",
      limit: "2",
    });

    const result = await createBooksService(repository).list(input);

    expect(result).toEqual({
      data: [],
      pagination: {
        page: 5,
        limit: 2,
        total: 3,
        totalPages: 2,
      },
    });
    expect(repository.count).toHaveBeenCalledWith(input);
    expect(repository.list).toHaveBeenCalledWith(input);
  });
});
