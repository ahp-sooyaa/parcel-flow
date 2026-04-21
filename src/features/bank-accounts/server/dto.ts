import "server-only";

export type BankAccountOwnerDto = {
    appUserId: string | null;
    isCompanyAccount: boolean;
};

export type BankAccountDto = {
    id: string;
    appUserId: string | null;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    isCompanyAccount: boolean;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export type BankAccountActionResult = {
    ok: boolean;
    message: string;
};

export function toBankAccountDto(input: BankAccountDto): BankAccountDto {
    return {
        id: input.id,
        appUserId: input.appUserId,
        bankName: input.bankName,
        bankAccountName: input.bankAccountName,
        bankAccountNumber: input.bankAccountNumber,
        isCompanyAccount: input.isCompanyAccount,
        isPrimary: input.isPrimary,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
    };
}
