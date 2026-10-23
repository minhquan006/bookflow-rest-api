import { describe, expect, it, vi } from "vitest";
import { createCategoriesService } from "../src/modules/categories/categories.service.js";

describe("Categories service", () => {
  it("returns category DTOs and pagination", async () => {
    const createdAt = new Date("2026-10-20T00:00:00.000Z");
    const repository = {
      count: vi.fn().mockResolvedValue(3),
      list: vi.fn().mockResolvedValue([
        {
          id: "bc862fb3-f221-48ff-883a-7561289e8164",
          name: "Fiction",
          slug: "fiction",
          createdAt,
        },
      ]),
    };

    const service = createCategoriesService(repository);
    const result = await service.list({ page: 2, limit: 2 });

    expect(result).toEqual({
      data: [
        {
          id: "bc862fb3-f221-48ff-883a-7561289e8164",
          name: "Fiction",
          slug: "fiction",
          createdAt: "2026-10-20T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      },
    });
    expect(repository.list).toHaveBeenCalledWith({ page: 2, limit: 2 });
  });

  it("returns an empty collection when no categories exist", async () => {
    const repository = {
      count: vi.fn().mockResolvedValue(0),
      list: vi.fn().mockResolvedValue([]),
    };

    const result = await createCategoriesService(repository).list({
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it("preserves total when the requested page is beyond the last page", async () => {
    const repository = {
      count: vi.fn().mockResolvedValue(2),
      list: vi.fn().mockResolvedValue([]),
    };

    const result = await createCategoriesService(repository).list({
      page: 3,
      limit: 2,
    });

    expect(result.data).toEqual([]);
    expect(result.pagination).toEqual({
      page: 3,
      limit: 2,
      total: 2,
      totalPages: 1,
    });
  });
});
