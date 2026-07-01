import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";

import type { UserListFiltersDto } from "@/features/users/server/dto";

const defaultFilters: UserListFiltersDto = {
  searchTerm: "",
  page: 1,
  pageSize: 20,
};

void mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  usePathname: () => "/dashboard/users",
  redirect: () => undefined,
  useSearchParams: () => new URLSearchParams(),
}));

describe("UserListTable", async () => {
  const { UserListTable } = await import("@/features/users/components/user-list-table");

  test("renders an empty state when no users match", () => {
    render(
      <UserListTable
        pageResult={{
          users: [],
          page: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 1,
        }}
        filters={defaultFilters}
        bankAccountsByUserId={{}}
        townships={[]}
        currentUserPhoneNumber={null}
      />,
    );

    expect(screen.getByText("No users found.")).toBeTruthy();
  });

  test("renders paginated users", () => {
    render(
      <UserListTable
        pageResult={{
          users: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              name: "Test User",
              phoneNumber: "09123456789",
              address: "Yangon",
              age: 30,
              role: "office_admin",
              shopName: null,
              serviceTownshipId: null,
              serviceTownshipName: null,
              isActive: true,
              mustResetPassword: false,
            },
          ],
          page: 1,
          pageSize: 20,
          totalCount: 1,
          totalPages: 1,
        }}
        filters={defaultFilters}
        bankAccountsByUserId={{}}
        townships={[]}
        currentUserPhoneNumber={null}
      />,
    );

    expect(screen.getByText("Test User")).toBeTruthy();
    expect(screen.getByText("09123456789")).toBeTruthy();
    expect(screen.getByText("Office Admin")).toBeTruthy();
  });
});
