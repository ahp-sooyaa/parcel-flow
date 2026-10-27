import { CreateUserForm } from "@/features/users/components/create-user-form";
import { getTownshipFormOptions } from "@/features/townships/server/form-options";
import type { CreatableUserRole } from "@/lib/domain";
import { getCurrentUser } from "@/lib/session";

type CreateUserFormLoaderProps = Readonly<{
  defaultRole?: CreatableUserRole;
  roleOptions?: readonly CreatableUserRole[];
  title?: string;
}>;

export async function CreateUserFormLoader({
  defaultRole,
  roleOptions,
  title,
}: CreateUserFormLoaderProps) {
  await getCurrentUser();
  const townships = await getTownshipFormOptions();

  return (
    <CreateUserForm
      townships={townships}
      defaultRole={defaultRole}
      roleOptions={roleOptions}
      title={title}
    />
  );
}
