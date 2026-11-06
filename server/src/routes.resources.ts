export type Resource = {
  path: string;
  methods: readonly string[];
  visibility: "public" | "authenticated" | "staff" | "admin";
};

// Resource visibility governs method negotiation; each real handler still enforces
// its own operation permissions, input validation and record ownership.
export const FOUNDATION_RESOURCES: readonly Resource[] = [
  { path: "/health/live", methods: ["GET"], visibility: "public" },
  { path: "/health/ready", methods: ["GET"], visibility: "public" },
  { path: "/openapi.yaml", methods: ["GET"], visibility: "public" },
  { path: "/docs", methods: ["GET"], visibility: "public" },
  { path: "/api/v1", methods: ["GET"], visibility: "public" },
];
export const API_RESOURCES: readonly Resource[] = [
  ...["register", "login", "refresh", "logout"].map((action) => ({
    path: `/auth/${action}`,
    methods: ["POST"],
    visibility: "public" as const,
  })),
  { path: "/users/me", methods: ["GET"], visibility: "authenticated" },
  { path: "/users", methods: ["GET"], visibility: "admin" },
  { path: "/users/:id", methods: ["PATCH"], visibility: "admin" },
  { path: "/categories", methods: ["GET", "POST"], visibility: "public" },
  { path: "/categories/:id", methods: ["PUT", "DELETE"], visibility: "staff" },
  { path: "/books", methods: ["GET", "POST"], visibility: "public" },
  {
    path: "/books/:id",
    methods: ["GET", "PUT", "PATCH", "DELETE"],
    visibility: "public",
  },
  { path: "/books/:id/availability", methods: ["GET"], visibility: "public" },
  { path: "/books/:id/copies", methods: ["GET", "POST"], visibility: "staff" },
  { path: "/copies/:id", methods: ["PATCH"], visibility: "staff" },
  { path: "/loans", methods: ["GET", "POST"], visibility: "authenticated" },
  { path: "/loans/:id", methods: ["GET"], visibility: "authenticated" },
  { path: "/loans/:id/return", methods: ["PUT"], visibility: "staff" },
  { path: "/dashboard", methods: ["GET"], visibility: "staff" },
  { path: "/audit-logs", methods: ["GET"], visibility: "admin" },
];
