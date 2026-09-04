import "server-only";

import type { PropertyListing, PropertySearchRequirement } from "@/domain/types";

/**
 * Listing discovery is abstracted so the MVP can run entirely on seeded data
 * while leaving one obvious seam for a real source. A live provider would
 * implement this same interface against a partner API — and only against a
 * source whose terms permit programmatic access.
 */
export interface PropertySearchProvider {
  readonly name: string;
  search(requirements: PropertySearchRequirement): Promise<PropertyListing[]>;
}
