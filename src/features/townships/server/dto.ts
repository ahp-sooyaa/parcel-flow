import "server-only";

export type TownshipListItemDto = {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
};

export type TownshipOptionDto = {
    id: string;
    name: string;
};

export type CreateTownshipActionResult = {
    ok: boolean;
    message: string;
    townshipId?: string;
    fieldErrors?: Partial<Record<string, string[]>>;
};

export function toTownshipListItemDto(input: TownshipListItemDto): TownshipListItemDto {
    return {
        id: input.id,
        name: input.name,
        isActive: input.isActive,
        createdAt: input.createdAt,
    };
}

export function toTownshipOptionDto(input: TownshipOptionDto): TownshipOptionDto {
    return {
        id: input.id,
        name: input.name,
    };
}
