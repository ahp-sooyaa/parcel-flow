import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const roleOptions = [
  { value: "super_admin", label: "Super Admin" },
  { value: "office_admin", label: "Office Admin" },
  { value: "rider", label: "Rider" },
  { value: "merchant", label: "Merchant" },
];

const permissions = [
  { value: "users.read", label: "Read Users" },
  { value: "users.write", label: "Manage Users" },
  { value: "parcels.read", label: "Read Parcels" },
  { value: "parcels.assign", label: "Assign Parcels" },
  { value: "riders.read", label: "Read Riders" },
  { value: "merchants.read", label: "Read Merchants" },
];

export default function CreateUserPage() {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 rounded-xl border bg-card p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create User</h1>
        <p className="text-sm text-muted-foreground">
          Create internal users with explicit role and permission assignment.
        </p>
      </header>

      <form className="space-y-5">
        <div className="grid gap-2">
          <Label htmlFor="full-name">Full Name</Label>
          <Input id="full-name" name="fullName" placeholder="Enter full name" required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="name@company.com" required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Select role
            </option>
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm leading-none font-medium">Permissions</legend>
          <p className="text-xs text-muted-foreground">
            Choose permissions allowed for this user account.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {permissions.map((permission) => (
              <label
                key={permission.value}
                className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={permission.value}
                  className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <span>{permission.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit">Create User</Button>
      </form>
    </section>
  );
}
