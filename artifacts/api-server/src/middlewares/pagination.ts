import type { Request } from "express";

export interface PaginationParams {
  limit: number;
  offset: number;
  page: number;
}

export function parsePagination(req: Request, defaultLimit = 50, maxLimit = 200): PaginationParams {
  const page = Math.max(1, parseInt(req.query["page"] as string) || 1);
  const rawLimit = parseInt(req.query["limit"] as string) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}

export function paginatedResponse<T>(data: T[], pagination: PaginationParams) {
  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      count: data.length,
      hasMore: data.length === pagination.limit,
    },
  };
}
