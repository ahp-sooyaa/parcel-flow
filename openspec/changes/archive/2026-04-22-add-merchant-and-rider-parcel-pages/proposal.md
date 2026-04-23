## Why

Parcel workflows currently stop at admin-only create and update paths, which leaves merchant and rider users without the parcel views they need for daily work. We need role-scoped parcel access now so merchants can manage only their own parcels from their self-detail page and riders can complete delivery work with a simplified, operational UI.

## What Changes

- Add merchant-scoped parcel listing inside the merchant self-detail route at `merchants/[id]`, using server-side filtering so merchant users only see parcels related to their linked merchant record.
- Allow merchant-role users with `merchant.view` access to open their own merchant detail page and reach parcel list data there without requiring `parcel-list.view`.
- Reuse the parcel detail, create, and edit flows for merchant users, while enforcing merchant self-scope on all parcel reads and mutations in server DAL/actions.
- Add rider-scoped parcel detail access with a rider-specific UI that shows only the operational fields riders need, including parcel type, COD/non-COD state, and collectable amount.
- Add rider parcel workflow actions from the parcel detail experience, with the next available action shown conditionally from parcel status and assignment, without exposing parcel create or edit access to rider users.
- Keep authorization fail-closed and role-aware on the server so UI reuse does not widen data access beyond linked merchant or assigned rider scope.

## Capabilities

### New Capabilities
- `parcel-role-access`: Role-scoped parcel list, detail, and action flows for merchant and rider users, including merchant self-service parcel access and rider next-step workflow UI.

### Modified Capabilities
- `merchant-management`: Merchant self-detail behavior expands to include merchant-owned parcel listing and parcel entry points without requiring standalone parcel list permission.
- `admin-parcel-management`: Parcel create and update access rules change from admin-only to role-aware rules that still preserve stricter admin capabilities while allowing merchant self-scope create/edit flows.

## Impact

- Affected code: `src/app/(dashboard)/dashboard/merchants/[id]*`, `src/app/(dashboard)/dashboard/riders/[id]*`, parcel routes under `src/app/(dashboard)/dashboard/parcels/*`, and `src/features/parcels/*`.
- Server impact: DAL and server actions must apply role-conditional filtering, linked-record ownership checks, and rider-specific allowed actions on the server.
- UI impact: parcel detail must support shared layout foundations with role-specific presentation, especially for rider next-step action controls and merchant parcel management entry points.
- Security/ops impact: expands parcel access for non-admin roles but only under explicit self-scope or assignment scope, reducing manual coordination while keeping sensitive parcel/payment data constrained.
