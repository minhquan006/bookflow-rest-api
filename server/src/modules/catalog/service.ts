import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../../db/pool.js";
import { AppError, forbidden } from "../../shared/errors.js";
import { paginate, type PaginationInput } from "../../shared/pagination.js";
import type { Principal } from "../../middleware/context.js";
import type {
  BookInput,
  BookQuery,
  CategoryInput,
  Condition,
} from "./schemas.js";
import * as repo from "./repository.js";
export const bookEtag = (book: repo.Book) =>
  `"book-${book.id}-v${book.version}"`;
const missing = () =>
  new AppError(
    404,
    "RESOURCE_NOT_FOUND",
    "Not Found",
    "The requested resource does not exist.",
  );
const conflict = (code: string, detail: string) =>
  new AppError(409, code, "Conflict", detail);
const isStaff = (principal?: Principal) =>
  principal?.role === "ADMIN" || principal?.role === "LIBRARIAN";
type Actor = Principal & { requestId: string };
function mapDatabaseError(error: unknown): never {
  if (error instanceof Error && "code" in error && "constraint" in error) {
    if (error.code === "23505") {
      const codes: Record<string, [string, string]> = {
        categories_name_normalized_unique: [
          "CATEGORY_ALREADY_EXISTS",
          "This category name is already in use.",
        ],
        categories_slug_key: [
          "CATEGORY_ALREADY_EXISTS",
          "This category slug is already in use.",
        ],
        books_isbn_key: ["ISBN_ALREADY_EXISTS", "This ISBN is already in use."],
        book_copies_barcode_key: [
          "BARCODE_ALREADY_EXISTS",
          "This barcode is already in use.",
        ],
      };
      const match = codes[String(error.constraint)];
      if (match) throw conflict(...match);
    }
    if (error.code === "23503" && error.constraint === "books_category_id_fkey")
      throw conflict("CATEGORY_NOT_FOUND", "Choose an existing category.");
  }
  throw error;
}
export function createCatalogService(pool: Pool) {
  async function mutate<T>(
    actor: Actor,
    work: (client: PoolClient) => Promise<T>,
  ) {
    if (!isStaff(actor)) throw forbidden();
    try {
      return await withTransaction(pool, work);
    } catch (error) {
      return mapDatabaseError(error);
    }
  }
  async function list<T>(
    query: PaginationInput,
    work: (client: PoolClient) => Promise<{ data: T[]; total: number }>,
  ) {
    return withTransaction(pool, async (client) => {
      await client.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const result = await work(client);
      return { data: result.data, pagination: paginate(query, result.total) };
    });
  }
  async function book(
    client: repo.Client,
    id: string,
    principal?: Principal,
    lock = false,
  ) {
    const value = await repo.findBook(client, id, lock);
    if (!value || (value.archivedAt && !isStaff(principal))) throw missing();
    return value;
  }
  function checkVersion(value: repo.Book, expected?: string) {
    if (!expected)
      throw new AppError(
        428,
        "PRECONDITION_REQUIRED",
        "Precondition Required",
        "Send the current book ETag in If-Match.",
      );
    if (expected !== bookEtag(value))
      throw new AppError(
        412,
        "VERSION_MISMATCH",
        "Precondition Failed",
        "The book has changed. Reload it before saving.",
      );
  }
  return {
    listCategories: (query: PaginationInput) =>
      list(query, (client) => repo.listCategories(client, query)),
    createCategory: (input: CategoryInput, actor: Actor) =>
      mutate(actor, async (client) => {
        const value = await repo.createCategory(client, input);
        await repo.audit(
          client,
          actor.id,
          "category.created",
          "category",
          value.id,
          actor.requestId,
        );
        return value;
      }),
    replaceCategory: (id: string, input: CategoryInput, actor: Actor) =>
      mutate(actor, async (client) => {
        const value = await repo.replaceCategory(client, id, input);
        if (!value) throw missing();
        await repo.audit(
          client,
          actor.id,
          "category.updated",
          "category",
          id,
          actor.requestId,
        );
        return value;
      }),
    deleteCategory: (id: string, actor: Actor) =>
      mutate(actor, async (client) => {
        try {
          if (!(await repo.deleteCategory(client, id))) throw missing();
        } catch (error) {
          if (
            error instanceof Error &&
            "code" in error &&
            error.code === "23503"
          )
            throw conflict(
              "CATEGORY_IN_USE",
              "This category is referenced by a book, including archived books.",
            );
          throw error;
        }
        await repo.audit(
          client,
          actor.id,
          "category.deleted",
          "category",
          id,
          actor.requestId,
        );
      }),
    listBooks: (query: BookQuery, principal?: Principal) => {
      if (query.includeArchived && !isStaff(principal)) throw forbidden();
      return list(query, (client) => repo.listBooks(client, query));
    },
    getBook: (id: string, principal?: Principal) => book(pool, id, principal),
    createBook: (input: BookInput, actor: Actor) =>
      mutate(actor, async (client) => {
        const value = await repo.createBook(client, input);
        await repo.audit(
          client,
          actor.id,
          "book.created",
          "book",
          value.id,
          actor.requestId,
        );
        return value;
      }),
    updateBook: (
      id: string,
      input: Partial<BookInput>,
      expected: string | undefined,
      actor: Actor,
    ) =>
      mutate(actor, async (client) => {
        const current = await book(client, id, actor, true);
        checkVersion(current, expected);
        const value = await repo.replaceBook(client, id, {
          ...current,
          ...input,
        });
        await repo.audit(
          client,
          actor.id,
          "book.updated",
          "book",
          id,
          actor.requestId,
        );
        return value;
      }),
    archiveBook: (id: string, expected: string | undefined, actor: Actor) =>
      mutate(actor, async (client) => {
        const current = await book(client, id, actor, true);
        checkVersion(current, expected);
        if (await repo.bookHasLoans(client, id))
          throw conflict(
            "BOOK_HAS_ACTIVE_LOANS",
            "Return all open loans before archiving this book.",
          );
        if (!current.archivedAt) {
          await repo.archiveBook(client, id);
          await repo.audit(
            client,
            actor.id,
            "book.archived",
            "book",
            id,
            actor.requestId,
          );
        }
      }),
    availability: async (id: string) => {
      const availableCopies = await repo.availability(pool, id);
      if (availableCopies === undefined) throw missing();
      return { bookId: id, availableCopies };
    },
    listCopies: async (
      id: string,
      query: PaginationInput,
      principal: Principal,
    ) => {
      if (!isStaff(principal)) throw forbidden();
      await book(pool, id, principal);
      return list(query, (client) => repo.listCopies(client, id, query));
    },
    createCopy: (id: string, barcode: string, actor: Actor) =>
      mutate(actor, async (client) => {
        const current = await book(client, id, actor, true);
        if (current.archivedAt)
          throw conflict(
            "BOOK_ARCHIVED",
            "Cannot add copies to an archived book.",
          );
        const value = await repo.createCopy(client, id, barcode);
        await repo.audit(
          client,
          actor.id,
          "copy.created",
          "copy",
          value.id,
          actor.requestId,
        );
        return value;
      }),
    updateCopy: (id: string, condition: Condition, actor: Actor) =>
      mutate(actor, async (client) => {
        const current = await repo.findCopy(client, id);
        if (!current) throw missing();
        if (await repo.copyHasLoan(client, id))
          throw conflict(
            "COPY_HAS_ACTIVE_LOAN",
            "Return the open loan before changing this copy.",
          );
        const value = await repo.updateCopy(client, id, condition);
        await repo.audit(
          client,
          actor.id,
          "copy.updated",
          "copy",
          id,
          actor.requestId,
        );
        return value;
      }),
  };
}
