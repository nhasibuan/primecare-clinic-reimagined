import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We need to test getDb() behavior, but it's tightly coupled to the module-level _db state.
// We'll test the observable behavior: what happens when DATABASE_URL is missing,
// and what getPublicClinicContent returns when the DB is unavailable.

// Mock drizzle to control connection behavior
const drizzleMock = vi.hoisted(() => vi.fn());

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: drizzleMock,
}));

// Mock the schema to avoid import issues
vi.mock("../drizzle/schema", () => ({
  clinicProfiles: { id: "id", name: "name" },
  services: { id: "id", isPublished: "isPublished", sortOrder: "sortOrder" },
  users: { id: "id", openId: "openId", role: "role", name: "name", email: "email", lastSignedIn: "lastSignedIn" },
  mediaAssets: { id: "id", uploadedAt: "uploadedAt" },
  whatsappSignatureTemplates: { id: "id", content: "content" },
  appointmentRequests: { id: "id", createdAt: "createdAt" },
  whatsappFollowUpActivities: { id: "id", createdAt: "createdAt", messageStatus: "messageStatus", finalDraftLength: "finalDraftLength" },
}));

describe("getDb behavior", () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    drizzleMock.mockReset();
    // Reset the module-level _db by re-importing
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("returns null when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;
    const { getDb } = await import("./db");
    const db = await getDb();
    expect(db).toBeNull();
  });

  it("attempts connection when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/test";
    drizzleMock.mockReturnValue({ select: vi.fn() });
    const { getDb } = await import("./db");
    const db = await getDb();
    expect(db).not.toBeNull();
    expect(drizzleMock).toHaveBeenCalledWith("mysql://user:pass@localhost:3306/test");
  });

  it("returns null when drizzle constructor throws", async () => {
    process.env.DATABASE_URL = "mysql://bad:connection@localhost:3306/test";
    drizzleMock.mockImplementation(() => { throw new Error("Connection refused"); });
    const { getDb } = await import("./db");
    const db = await getDb();
    expect(db).toBeNull();
  });
});

describe("getPublicClinicContent error surfacing", () => {
  it("throws when database is unavailable", async () => {
    delete process.env.DATABASE_URL;
    const { getPublicClinicContent } = await import("./db");
    await expect(getPublicClinicContent()).rejects.toThrow("temporarily unavailable");
  });
});
