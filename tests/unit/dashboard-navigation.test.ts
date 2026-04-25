import { describe, expect, it } from "vitest";
import { getDashboardNavigation } from "../../src/lib/dashboard-navigation";

import type { DashboardNavItem } from "../../src/lib/dashboard-navigation";

const adminNavItems: DashboardNavItem[] = [
    { key: "dashboard", href: "/dashboard", label: "Dashboard" },
    { key: "users", href: "/dashboard/users", label: "Users" },
    { key: "merchants", href: "/dashboard/merchants", label: "Merchants" },
    { key: "riders", href: "/dashboard/riders", label: "Riders" },
    { key: "parcels", href: "/dashboard/parcels", label: "Parcels" },
    { key: "settlements", href: "/dashboard/settlements", label: "Settlements" },
    { key: "townships", href: "/dashboard/townships", label: "Townships" },
];

describe("dashboard navigation", () => {
    it("keeps top-level routes as a single breadcrumb with no back link", () => {
        expect(
            getDashboardNavigation({
                pathname: "/dashboard/parcels",
                searchParams: new URLSearchParams("page=2&q=ready"),
                navItems: adminNavItems,
            }),
        ).toEqual({
            breadcrumbs: [{ label: "Parcels" }],
            backHref: null,
        });
    });

    it("resolves admin merchant and rider detail routes back to their list pages", () => {
        expect(
            getDashboardNavigation({
                pathname: "/dashboard/merchants/merchant-1",
                searchParams: new URLSearchParams(),
                navItems: adminNavItems,
            }),
        ).toEqual({
            breadcrumbs: [
                { label: "Merchants", href: "/dashboard/merchants" },
                { label: "Merchant Detail" },
            ],
            backHref: "/dashboard/merchants",
        });

        expect(
            getDashboardNavigation({
                pathname: "/dashboard/riders/rider-1",
                searchParams: new URLSearchParams(),
                navItems: adminNavItems,
            }),
        ).toEqual({
            breadcrumbs: [
                { label: "Riders", href: "/dashboard/riders" },
                { label: "Rider Detail" },
            ],
            backHref: "/dashboard/riders",
        });
    });

    it("treats merchant and rider self routes as top-level My Parcels pages", () => {
        const merchantNavItems: DashboardNavItem[] = [
            { key: "dashboard", href: "/dashboard", label: "Dashboard" },
            { key: "parcels", href: "/dashboard/merchants/merchant-self", label: "My Parcels" },
        ];
        const riderNavItems: DashboardNavItem[] = [
            { key: "dashboard", href: "/dashboard", label: "Dashboard" },
            { key: "parcels", href: "/dashboard/riders/rider-self", label: "My Parcels" },
        ];

        expect(
            getDashboardNavigation({
                pathname: "/dashboard/merchants/merchant-self",
                searchParams: new URLSearchParams("tab=settlements"),
                navItems: merchantNavItems,
            }),
        ).toEqual({
            breadcrumbs: [{ label: "My Parcels" }],
            backHref: null,
        });

        expect(
            getDashboardNavigation({
                pathname: "/dashboard/riders/rider-self",
                searchParams: new URLSearchParams(),
                navItems: riderNavItems,
            }),
        ).toEqual({
            breadcrumbs: [{ label: "My Parcels" }],
            backHref: null,
        });
    });

    it("routes create-user breadcrumbs through merchant and rider sections when role is provided", () => {
        expect(
            getDashboardNavigation({
                pathname: "/dashboard/users/create",
                searchParams: new URLSearchParams("role=merchant"),
                navItems: adminNavItems,
            }),
        ).toEqual({
            breadcrumbs: [
                { label: "Merchants", href: "/dashboard/merchants" },
                { label: "Create User" },
            ],
            backHref: "/dashboard/merchants",
        });

        expect(
            getDashboardNavigation({
                pathname: "/dashboard/users/create",
                searchParams: new URLSearchParams("role=rider"),
                navItems: adminNavItems,
            }),
        ).toEqual({
            breadcrumbs: [{ label: "Riders", href: "/dashboard/riders" }, { label: "Create User" }],
            backHref: "/dashboard/riders",
        });
    });

    it("resolves parcel detail breadcrumbs from the current user's parcels nav item", () => {
        const merchantNavItems: DashboardNavItem[] = [
            { key: "dashboard", href: "/dashboard", label: "Dashboard" },
            { key: "parcels", href: "/dashboard/merchants/merchant-self", label: "My Parcels" },
        ];

        expect(
            getDashboardNavigation({
                pathname: "/dashboard/parcels/parcel-1",
                searchParams: new URLSearchParams(),
                navItems: merchantNavItems,
            }),
        ).toEqual({
            breadcrumbs: [
                { label: "My Parcels", href: "/dashboard/merchants/merchant-self" },
                { label: "Parcel Detail" },
            ],
            backHref: "/dashboard/merchants/merchant-self",
        });
    });

    it("uses returnTo to override the default settlement parent", () => {
        const returnTo = "/dashboard/merchants/merchant-1?tab=settlements";

        expect(
            getDashboardNavigation({
                pathname: "/dashboard/settlements/settlement-1",
                searchParams: new URLSearchParams(`returnTo=${encodeURIComponent(returnTo)}`),
                navItems: adminNavItems,
            }),
        ).toEqual({
            breadcrumbs: [
                { label: "Merchants", href: "/dashboard/merchants" },
                { label: "Merchant Detail", href: returnTo },
                { label: "Settlement Detail" },
            ],
            backHref: returnTo,
        });
    });

    it("uses returnTo to override the default parcel parent", () => {
        const returnTo = "/dashboard/parcels?page=2&q=ready";

        expect(
            getDashboardNavigation({
                pathname: "/dashboard/parcels/parcel-1/edit",
                searchParams: new URLSearchParams(`returnTo=${encodeURIComponent(returnTo)}`),
                navItems: adminNavItems,
            }),
        ).toEqual({
            breadcrumbs: [{ label: "Parcels", href: returnTo }, { label: "Edit Parcel" }],
            backHref: returnTo,
        });
    });

    it("uses returnTo to override the default user-edit parent", () => {
        const returnTo = "/dashboard/riders/rider-1";

        expect(
            getDashboardNavigation({
                pathname: "/dashboard/users/user-1/edit",
                searchParams: new URLSearchParams(`returnTo=${encodeURIComponent(returnTo)}`),
                navItems: adminNavItems,
            }),
        ).toEqual({
            breadcrumbs: [
                { label: "Riders", href: "/dashboard/riders" },
                { label: "Rider Detail", href: returnTo },
                { label: "Edit User" },
            ],
            backHref: returnTo,
        });
    });

    it("falls back to the user detail page when edit-user has no returnTo", () => {
        expect(
            getDashboardNavigation({
                pathname: "/dashboard/users/user-1/edit",
                searchParams: new URLSearchParams(),
                navItems: adminNavItems,
            }),
        ).toEqual({
            breadcrumbs: [
                { label: "Users", href: "/dashboard/users" },
                { label: "User Detail", href: "/dashboard/users/user-1" },
                { label: "Edit User" },
            ],
            backHref: "/dashboard/users/user-1",
        });
    });
});
