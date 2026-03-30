import "server-only";

export type ProfileActionResult = {
  ok: boolean;
  message: string;
};

export type ProfilePageDto = {
  fullName: string;
  email: string;
  phoneNumber: string | null;
};

export function toProfilePageDto(input: ProfilePageDto): ProfilePageDto {
  return {
    fullName: input.fullName,
    email: input.email,
    phoneNumber: input.phoneNumber,
  };
}
