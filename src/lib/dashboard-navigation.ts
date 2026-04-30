const DASHBOARD_BASE_URL = "http://dashboard.local";

export type DashboardNavItemKey =
    | "dashboard"
    | "users"
    | "merchants"
    | "riders"
    | "parcels"
    | "settlements"
    | "townships"
    | "delivery-pricing";

export type DashboardNavItem = {
    key: DashboardNavItemKey;
    href: string;
    label: string;
};

export type DashboardBreadcrumb = {
    label: string;
    href?: string;
};

export type DashboardNavigation = {
    breadcrumbs: DashboardBreadcrumb[];
    backHref: string | null;
};

type DashboardSearchParamsRecord = Readonly<
    Record<string, string | readonly string[] | string[] | undefined>
>;

type DashboardSearchParamsInput =
    | DashboardSearchParamsRecord
    | Pick<URLSearchParams, "get" | "toString">
    | URLSearchParams
    | undefined;

type DashboardNavigationInput = {
    pathname: string;
    searchParams?: DashboardSearchParamsInput;
    navItems: DashboardNavItem[];
};

type DashboardRouteResolution = {
    label: string;
    parentHref: string | null;
};

type DashboardBreadcrumbNode = {
    label: string;
    href: string;
};

const topLevelLabelByPath = {
    "/dashboard": "Dashboard",
    "/dashboard/merchants": "Merchants",
    "/dashboard/parcels": "Parcels",
    "/dashboard/riders": "Riders",
    "/dashboard/settings": "Settings",
    "/dashboard/settlements": "Settlements",
    "/dashboard/townships": "Townships",
    "/dashboard/delivery-pricing": "Delivery Pricing",
    "/dashboard/users": "Users",
} as const satisfies Record<string, string>;

function normalizePathname(pathname: string) {
    if (!pathname) {
        return "/";
    }

    if (pathname.length > 1 && pathname.endsWith("/")) {
        return pathname.slice(0, -1);
    }

    return pathname;
}

function isDashboardPathname(pathname: string) {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function toURLSearchParams(input: DashboardSearchParamsInput) {
    if (!input) {
        return new URLSearchParams();
    }

    if (input instanceof URLSearchParams) {
        return new URLSearchParams(input.toString());
    }

    if (typeof input.get === "function" && typeof input.toString === "function") {
        return new URLSearchParams(input.toString());
    }

    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(input)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                searchParams.append(key, item);
            }
            continue;
        }

        if (typeof value === "string") {
            searchParams.set(key, value);
        }
    }

    return searchParams;
}

function findNavItemByHref(navItems: DashboardNavItem[], pathname: string) {
    return navItems.find((item) => normalizePathname(item.href) === pathname);
}

function findNavItemByKey(navItems: DashboardNavItem[], key: DashboardNavItemKey) {
    return navItems.find((item) => item.key === key);
}

function parseDashboardHref(href: string) {
    const safeHref = getSafeDashboardHref(href);

    if (!safeHref) {
        return null;
    }

    const parsed = new URL(safeHref, DASHBOARD_BASE_URL);

    return {
        pathname: normalizePathname(parsed.pathname),
        searchParams: parsed.searchParams,
    };
}

function getReturnToHref(searchParams: URLSearchParams) {
    return getSafeDashboardHref(searchParams.get("returnTo"));
}

function resolveUsersCreateParentHref(navItems: DashboardNavItem[], role: string | null) {
    if (role === "merchant") {
        return findNavItemByKey(navItems, "merchants")?.href ?? "/dashboard/users";
    }

    if (role === "rider") {
        return findNavItemByKey(navItems, "riders")?.href ?? "/dashboard/users";
    }

    return "/dashboard/users";
}

function resolveParcelsParentHref(navItems: DashboardNavItem[]) {
    return findNavItemByKey(navItems, "parcels")?.href ?? "/dashboard/parcels";
}

function resolveDashboardRoute({
    pathname,
    searchParams,
    navItems,
}: DashboardNavigationInput): DashboardRouteResolution {
    const normalizedPathname = normalizePathname(pathname);
    const normalizedSearchParams = toURLSearchParams(searchParams);
    const exactNavItem = findNavItemByHref(navItems, normalizedPathname);

    if (exactNavItem) {
        return {
            label: exactNavItem.label,
            parentHref: null,
        };
    }

    const topLevelLabel =
        topLevelLabelByPath[normalizedPathname as keyof typeof topLevelLabelByPath] ?? null;

    if (topLevelLabel) {
        return {
            label: topLevelLabel,
            parentHref: null,
        };
    }

    const segments = normalizedPathname.split("/").filter(Boolean);
    const section = segments[1] ?? "";
    const recordId = segments[2] ?? "";
    const action = segments[3] ?? "";
    const returnToHref = getReturnToHref(normalizedSearchParams);

    switch (section) {
        case "users":
            if (recordId === "create") {
                return {
                    label: "Create User",
                    parentHref: resolveUsersCreateParentHref(
                        navItems,
                        normalizedSearchParams.get("role"),
                    ),
                };
            }

            if (action === "edit" && recordId) {
                return {
                    label: "Edit User",
                    parentHref: returnToHref ?? `/dashboard/users/${recordId}`,
                };
            }

            if (recordId) {
                return {
                    label: "User Detail",
                    parentHref: "/dashboard/users",
                };
            }
            break;
        case "merchants":
            if (recordId) {
                return {
                    label: "Merchant Detail",
                    parentHref: "/dashboard/merchants",
                };
            }
            break;
        case "riders":
            if (recordId) {
                return {
                    label: "Rider Detail",
                    parentHref: "/dashboard/riders",
                };
            }
            break;
        case "parcels":
            if (recordId === "create") {
                return {
                    label: "Create Parcel",
                    parentHref: returnToHref ?? resolveParcelsParentHref(navItems),
                };
            }

            if (action === "edit" && recordId) {
                return {
                    label: "Edit Parcel",
                    parentHref: returnToHref ?? resolveParcelsParentHref(navItems),
                };
            }

            if (recordId) {
                return {
                    label: "Parcel Detail",
                    parentHref: returnToHref ?? resolveParcelsParentHref(navItems),
                };
            }
            break;
        case "settlements":
            if (recordId) {
                return {
                    label: "Settlement Detail",
                    parentHref: returnToHref ?? "/dashboard/settlements",
                };
            }
            break;
        case "townships":
            if (recordId === "create") {
                return {
                    label: "Create Township",
                    parentHref: "/dashboard/townships",
                };
            }
            break;
        case "delivery-pricing":
            return {
                label: "Delivery Pricing",
                parentHref: null,
            };
        default:
            break;
    }

    return {
        label: "Dashboard",
        parentHref: null,
    };
}

function buildNavigationChain(
    href: string,
    navItems: DashboardNavItem[],
    visited: Set<string>,
): DashboardBreadcrumbNode[] {
    const safeHref = getSafeDashboardHref(href);

    if (!safeHref || visited.has(safeHref)) {
        return [];
    }

    const parsed = parseDashboardHref(safeHref);

    if (!parsed) {
        return [];
    }

    const route = resolveDashboardRoute({
        pathname: parsed.pathname,
        searchParams: parsed.searchParams,
        navItems,
    });
    const currentNode: DashboardBreadcrumbNode = {
        label: route.label,
        href: safeHref,
    };
    const parentHref = route.parentHref;

    if (!parentHref || parentHref === safeHref) {
        return [currentNode];
    }

    const parentNodes = buildNavigationChain(parentHref, navItems, new Set([...visited, safeHref]));

    return [...parentNodes, currentNode];
}

export function buildDashboardHref(pathname: string, searchParams?: DashboardSearchParamsInput) {
    const normalizedPathname = normalizePathname(pathname);
    const query = toURLSearchParams(searchParams).toString();

    return query ? `${normalizedPathname}?${query}` : normalizedPathname;
}

export function getSafeDashboardHref(href: string | null | undefined) {
    if (!href) {
        return null;
    }

    let parsedHref: URL;

    try {
        parsedHref = new URL(href, DASHBOARD_BASE_URL);
    } catch {
        return null;
    }

    if (parsedHref.origin !== DASHBOARD_BASE_URL) {
        return null;
    }

    const normalizedPathname = normalizePathname(parsedHref.pathname);

    if (!isDashboardPathname(normalizedPathname)) {
        return null;
    }

    return `${normalizedPathname}${parsedHref.search}${parsedHref.hash}`;
}

export function appendDashboardReturnTo(href: string, returnTo: string | null | undefined) {
    const safeReturnTo = getSafeDashboardHref(returnTo);

    if (!safeReturnTo) {
        return href;
    }

    let parsedHref: URL;

    try {
        parsedHref = new URL(href, DASHBOARD_BASE_URL);
    } catch {
        return href;
    }

    const normalizedPathname = normalizePathname(parsedHref.pathname);

    if (parsedHref.origin !== DASHBOARD_BASE_URL || !isDashboardPathname(normalizedPathname)) {
        return href;
    }

    parsedHref.searchParams.set("returnTo", safeReturnTo);

    return `${normalizedPathname}${parsedHref.search}${parsedHref.hash}`;
}

export function getDashboardNavigation({
    pathname,
    searchParams,
    navItems,
}: DashboardNavigationInput): DashboardNavigation {
    const currentHref = buildDashboardHref(pathname, searchParams);
    const chain = buildNavigationChain(currentHref, navItems, new Set());

    if (chain.length === 0) {
        return {
            breadcrumbs: [{ label: "Dashboard" }],
            backHref: null,
        };
    }

    return {
        breadcrumbs: chain.map((node, index) =>
            index === chain.length - 1
                ? { label: node.label }
                : {
                      label: node.label,
                      href: node.href,
                  },
        ),
        backHref: chain.length > 1 ? (chain[chain.length - 2]?.href ?? null) : null,
    };
}
