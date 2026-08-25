import { describe, expect, it } from "vitest";
import { resolveUserRole } from "./db";

describe("user role resolution", () => {
  it("preserves an existing administrator role when OAuth provides no role", () => {
    expect(resolveUserRole(undefined, "admin", "clinic-owner", "project-owner")).toBe("admin");
  });

  it("defaults the configured project owner to administrator", () => {
    expect(resolveUserRole(undefined, undefined, "project-owner", "project-owner")).toBe("admin");
  });

  it("defaults a new non-owner account to a regular user", () => {
    expect(resolveUserRole(undefined, undefined, "new-user", "project-owner")).toBe("user");
  });

  it("respects an explicitly supplied role", () => {
    expect(resolveUserRole("user", "admin", "clinic-owner", "project-owner")).toBe("user");
  });
});
