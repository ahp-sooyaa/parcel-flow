import "server-only";
import { BankAccountActionForms } from "./bank-account-actions";
import { BankAccountCreateForm } from "./bank-account-create-form";
import { BankAccountEditForm } from "./bank-account-edit-form";
import { getBankAccountAccess } from "@/features/auth/server/policies/bank-accounts";
import { getBankAccountsForViewer } from "@/features/bank-accounts/server/dal";

import type { AppAccessContext } from "@/features/auth/server/dto";
import type { BankAccountOwnerDto } from "@/features/bank-accounts/server/dto";

type BankAccountsPanelProps = {
    viewer: AppAccessContext;
    owner: BankAccountOwnerDto;
    title: string;
    description: string;
    basePath: string;
};

export async function BankAccountsPanel({
    viewer,
    owner,
    title,
    description,
    basePath,
}: Readonly<BankAccountsPanelProps>) {
    const access = getBankAccountAccess({ viewer, owner });

    if (!access.canView) {
        return null;
    }

    const accounts = await getBankAccountsForViewer(viewer, owner);
    const ownerType = owner.isCompanyAccount ? "company" : "user";
    const ownerAppUserId = owner.appUserId;

    return (
        <div className="space-y-5">
            <header className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                <p className="text-xs text-muted-foreground">{description}</p>
            </header>

            {access.canCreate && (
                <BankAccountCreateForm
                    ownerType={ownerType}
                    ownerAppUserId={ownerAppUserId}
                    basePath={basePath}
                />
            )}

            <div className="space-y-3">
                {accounts.map((account) => (
                    <article key={account.id} className="space-y-4 rounded-xl border p-4">
                        {access.canUpdate ? (
                            <BankAccountEditForm
                                account={account}
                                ownerType={ownerType}
                                ownerAppUserId={ownerAppUserId}
                                basePath={basePath}
                            />
                        ) : (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold">{account.bankName}</h3>
                                    {account.isPrimary && (
                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                            Primary
                                        </span>
                                    )}
                                </div>

                                <dl className="grid gap-3 text-sm md:grid-cols-3">
                                    <div className="grid gap-1">
                                        <dt className="text-xs text-muted-foreground">
                                            Account Name
                                        </dt>
                                        <dd>{account.bankAccountName}</dd>
                                    </div>
                                    <div className="grid gap-1">
                                        <dt className="text-xs text-muted-foreground">
                                            Account Number
                                        </dt>
                                        <dd>{account.bankAccountNumber}</dd>
                                    </div>
                                    <div className="grid gap-1">
                                        <dt className="text-xs text-muted-foreground">Type</dt>
                                        <dd>
                                            {account.isCompanyAccount
                                                ? "Company account"
                                                : "User account"}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        )}

                        {(access.canUpdate || access.canDelete) && (
                            <BankAccountActionForms
                                account={account}
                                ownerType={ownerType}
                                ownerAppUserId={ownerAppUserId}
                                basePath={basePath}
                                permissions={{
                                    canUpdate: access.canUpdate,
                                    canDelete: access.canDelete,
                                }}
                            />
                        )}
                    </article>
                ))}

                {accounts.length === 0 && (
                    <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                        No bank accounts found.
                    </div>
                )}
            </div>
        </div>
    );
}
