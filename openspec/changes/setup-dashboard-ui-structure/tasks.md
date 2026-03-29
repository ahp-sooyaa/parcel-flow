## 1. Route Scaffold

- [x] 1.1 Create route group directories for `src/app/(auth)/sign-in` and `src/app/(dashboard)` sections (`dashboard`, `users`, `merchants`, `riders`, `parcels`, `unauthorized`).
- [x] 1.2 Add baseline `page.tsx` files for all listed dashboard section routes.
- [x] 1.3 Add `src/app/(dashboard)/users/create/page.tsx` route for user creation UI.

## 2. Dashboard Shell Layout

- [x] 2.1 Implement `src/app/(dashboard)/layout.tsx` with app-shell structure and content slot.
- [x] 2.2 Build sidebar menu links for required dashboard sections.
- [x] 2.3 Display app name and signed-in user context area in the shell.

## 3. Auth And User Create Pages

- [x] 3.1 Implement `src/app/(auth)/sign-in/page.tsx` with identity/password inputs and submit control.
- [x] 3.2 Implement `src/app/(dashboard)/users/create/page.tsx` with explicit role selection field.
- [x] 3.3 Add explicit permissions field to the user create page with clear labeling.

## 4. Placeholder Content And Validation

- [x] 4.1 Set non-implemented dashboard pages to render `coming soon...`.
- [x] 4.2 Verify sign-in page does not render dashboard sidebar shell.
- [x] 4.3 Run lint/typecheck and manually verify navigation links render and route correctly.

## 5. Dashboard Error And Not-Found Boundaries

- [x] 5.1 Implement `src/app/(dashboard)/not-found.tsx` with a clear message and navigation action back to dashboard home.
- [x] 5.2 Implement `src/app/(dashboard)/error.tsx` as a client error boundary UI with retry action and safe fallback copy.
- [x] 5.3 Verify dashboard missing-route and runtime-error states show the custom fallback UIs instead of defaults.
