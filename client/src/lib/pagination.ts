export type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedCollection<T> = {
  data: T[];
  pagination: PaginationInfo;
};
