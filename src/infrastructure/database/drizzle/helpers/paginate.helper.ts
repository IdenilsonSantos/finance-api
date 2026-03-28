export function paginate(page: number, limit: number) {
  return {
    limit,
    offset: (page - 1) * limit,
  };
}
