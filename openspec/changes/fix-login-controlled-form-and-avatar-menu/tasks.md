## 1. Login Form State

- [x] 1.1 Update `src/features/auth/components/login-form.tsx` to manage `username` and `password` with explicit controlled component state while preserving `useActionState` submission flow.
- [x] 1.2 Synchronize server-returned login error state back into the controlled username field and keep pending/error messaging behavior intact.
- [x] 1.3 Adjust related auth form types or server action response shape only if needed to support stable controlled-field behavior without changing role-based login redirects.

## 2. Dashboard Account Menu

- [x] 2.1 Add a focused account-menu UI for the dashboard header that renders a FaceHash-generated avatar with shadcn avatar and dropdown-menu primitives.
- [x] 2.2 Replace the current static dashboard user text block in `src/components/layout/dashboard-shell.tsx` with the new avatar-triggered account control while still showing user identity details inside the menu.
- [x] 2.3 Implement Better Auth sign-out wiring for the dropdown logout action and redirect users to the appropriate signed-out route after session termination.

## 3. Verification

- [x] 3.1 Verify the login form no longer produces uncontrolled-to-controlled warnings during invalid and valid submission attempts.
- [x] 3.2 Verify the dashboard header shows a deterministic generated avatar, opens the account menu correctly, and signs the user out through the new dropdown action.
- [x] 3.3 Run lint and typecheck after the implementation changes and resolve any regressions introduced by the new controlled form or account-menu components.
