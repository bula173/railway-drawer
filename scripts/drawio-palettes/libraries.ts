/** Per-library metadata (notice files, attribution) — filled in below. */
export interface LibraryInfo { notice?: string; attribution?: string; vendorImages?: boolean }
export function libraryInfo(_id: string): LibraryInfo { return {}; }
