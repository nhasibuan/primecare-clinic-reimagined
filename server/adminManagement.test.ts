import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  promoteUser: vi.fn(),
  demoteUser: vi.fn(),
  countAdmins: vi.fn(),
}));

vi.mock("./repositories/userRepository", async importOriginal => {
  const actual = await importOriginal<typeof import("./repositories/userRepository")>();
  return {
    ...actual,
    listUsers: dbMocks.listUsers,
    promoteUser: dbMocks.promoteUser,
    demoteUser: dbMocks.demoteUser,
    countAdmins: dbMocks.countAdmins,
  };
});

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(userId = 1): { ctx: TrpcContext; user: AuthenticatedUser } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `admin-${userId}`,
    email: `admin${userId}@example.com`,
    name: `Admin ${userId}`,
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    ctx: {
      user,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    },
    user,
  };
}

const mockUser = (id: number, role: "admin" | "user" = "user") => ({
  id,
  openId: `user-${id}`,
  name: `User ${id}`,
  email: `user${id}@example.com`,
  role,
  lastSignedIn: new Date(),
});

describe("admin management", () => {
  beforeEach(() => {
    dbMocks.listUsers.mockReset();
    dbMocks.promoteUser.mockReset();
    dbMocks.demoteUser.mockReset();
    dbMocks.countAdmins.mockReset();
  });

  describe("self-promotion guard", () => {
    it("rejects promoting yourself", async () => {
      const { ctx } = createAdminContext(1);
      const caller = appRouter.createCaller(ctx);

      await expect(caller.admin.promoteUser({ userId: 1 })).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("diri sendiri"),
      });
      expect(dbMocks.promoteUser).not.toHaveBeenCalled();
    });
  });

  describe("self-demotion guard", () => {
    it("rejects demoting yourself", async () => {
      const { ctx } = createAdminContext(1);
      const caller = appRouter.createCaller(ctx);

      await expect(caller.admin.demoteUser({ userId: 1 })).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("diri sendiri"),
      });
      expect(dbMocks.demoteUser).not.toHaveBeenCalled();
    });
  });

  describe("promoteUser", () => {
    it("promotes a user and returns updated record", async () => {
      const { ctx } = createAdminContext(1);
      const promoted = mockUser(5, "admin");
      dbMocks.promoteUser.mockResolvedValue(promoted);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.promoteUser({ userId: 5 });

      expect(result).toEqual(promoted);
      expect(dbMocks.promoteUser).toHaveBeenCalledWith(5);
    });
  });

  describe("demoteUser", () => {
    it("demotes an admin when there are multiple admins", async () => {
      const { ctx } = createAdminContext(1);
      const demoted = mockUser(5, "user");
      dbMocks.demoteUser.mockResolvedValue(demoted);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.demoteUser({ userId: 5 });

      expect(result).toEqual(demoted);
      expect(dbMocks.demoteUser).toHaveBeenCalledWith(5);
    });

    it("rejects demoting the last admin", async () => {
      const { ctx } = createAdminContext(1);
      dbMocks.demoteUser.mockRejectedValue(
        new Error("Tidak dapat menurunkan administrator terakhir. Tambahkan administrator lain terlebih dahulu."),
      );

      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.demoteUser({ userId: 5 })).rejects.toThrow(
        "Tidak dapat menurunkan administrator terakhir",
      );
    });
  });

  describe("listUsers", () => {
    it("returns the user list", async () => {
      const { ctx } = createAdminContext(1);
      const users = [mockUser(1, "admin"), mockUser(2, "user")];
      dbMocks.listUsers.mockResolvedValue(users);

      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.listUsers();

      expect(result).toEqual(users);
      expect(dbMocks.listUsers).toHaveBeenCalled();
    });
  });
});
