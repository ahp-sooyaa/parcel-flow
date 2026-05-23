import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildParcelListItem } from "../fixtures/builders";

const createUserActionMock = mock(async () => ({
  ok: true,
  message: "User account created.",
  temporaryPassword: "TempPassword123!",
  user: {
    id: "created-user-id",
  },
}));
const createTownshipActionMock = mock(async () => ({
  ok: true,
  message: "Township pricing saved.",
  township: testTownship(),
}));
const updateTownshipActionMock = mock(async () => ({
  ok: true,
  message: "Township pricing saved.",
  township: testTownship(),
}));
const createParcelActionMock = mock(async () => ({
  ok: true,
  message: "Parcel created.",
  parcel: {
    id: "parcel-id",
    parcelCode: "PF-000001-000001",
    receiverName: "Receiver",
  },
}));
const updateParcelActionMock = mock(async () => ({
  ok: true,
  message: "Parcel updated.",
}));
const assignParcelsToRiderActionMock = mock(async () => ({
  ok: true,
  message: "Parcels assigned.",
}));

void mock.module("@/features/users/server/actions", () => ({
  createUserAction: createUserActionMock,
}));

void mock.module("@/features/townships/server/actions", () => ({
  createTownshipAction: createTownshipActionMock,
  updateTownshipAction: updateTownshipActionMock,
}));

void mock.module("@/features/parcels/server/actions", () => ({
  assignParcelsToRiderAction: assignParcelsToRiderActionMock,
  createParcelAction: createParcelActionMock,
  updateParcelAction: updateParcelActionMock,
}));

void mock.module("@/lib/client-navigation", () => ({
  useAppRouter: () => ({
    refresh: () => undefined,
  }),
}));

describe("feature forms", async () => {
  const { CreateUserForm } = await import("@/features/users/components/create-user-form");
  const { TownshipForm } = await import("@/features/townships/components/township-form");
  const { CreateParcelForm } = await import("@/features/parcels/components/create-parcel-form");
  const { EditParcelForm } = await import("@/features/parcels/components/edit-parcel-form");
  const { Sheet, SheetContent } = await import("@/components/ui/sheet");

  beforeEach(() => {
    createUserActionMock.mockReset();
    createTownshipActionMock.mockReset();
    updateTownshipActionMock.mockReset();
    createParcelActionMock.mockReset();
    updateParcelActionMock.mockReset();
    createUserActionMock.mockResolvedValue({
      ok: true,
      message: "User account created.",
      temporaryPassword: "TempPassword123!",
      user: {
        id: "created-user-id",
      },
    });
    createTownshipActionMock.mockResolvedValue({
      ok: true,
      message: "Township pricing saved.",
      township: testTownship(),
    });
    updateTownshipActionMock.mockResolvedValue({
      ok: true,
      message: "Township pricing saved.",
      township: testTownship(),
    });
    createParcelActionMock.mockResolvedValue({
      ok: true,
      message: "Parcel created.",
      parcel: {
        id: "parcel-id",
        parcelCode: "PF-000001-000001",
        receiverName: "Receiver",
      },
    });
    updateParcelActionMock.mockResolvedValue({
      ok: true,
      message: "Parcel updated.",
    });
  });

  test("renders user create form with role-specific controls", () => {
    renderInSheet(<CreateUserForm townships={[testTownship()]} />);

    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Phone number")).toBeTruthy();
    expect(screen.getByLabelText("Role")).toBeTruthy();
    expect(getButton("Create User").disabled).toBe(false);
  });

  test("regenerates the temporary password and submits merchant-only fields", async () => {
    const user = userEvent.setup();
    renderInSheet(<CreateUserForm townships={[testTownship()]} />);

    const passwordInput = getInput("Generated password");
    await user.click(getButton("Regenerate"));
    expect(passwordInput.value.length).toBeGreaterThanOrEqual(12);

    await chooseSelectOption("Role", "Merchant");
    await user.type(screen.getByLabelText("Name"), "Merchant User");
    await user.type(screen.getByLabelText("Phone number"), "09999999999");
    await user.type(screen.getByLabelText("Address"), "Merchant address");
    await user.type(screen.getByLabelText("Shop"), "Merchant Shop");
    await user.click(getButton("Create User"));
    await screen.findByText("Merchant account is ready to hand off.");

    expect(createUserActionMock).toHaveBeenCalledWith({
      name: "Merchant User",
      phoneNumber: "09999999999",
      address: "Merchant address",
      age: "",
      isActive: true,
      role: "merchant",
      password: passwordInput.value,
      shopName: "Merchant Shop",
      serviceTownshipId: undefined,
    });
  });

  test("renders township edit mode and submits the current pricing payload", async () => {
    const user = userEvent.setup();
    renderInSheet(<TownshipForm mode="edit" township={testTownship()} />);

    expect(screen.getByRole("heading", { name: "Edit Township" })).toBeTruthy();
    await user.click(getButton("Save Changes"));
    await screen.findByText("Yangon pricing is ready to save.");

    expect(updateTownshipActionMock).toHaveBeenCalledWith({
      id: "township-id",
      name: "Yangon",
      baseFee: "2000",
      baseWeightKg: "3",
      extraWeightFee: "500",
      extraWeightUnitKg: "1",
      volumetricDivisor: "5000",
      codFeePercent: "0",
      returnFeePercent: "100",
      isActive: true,
    });
  });

  test("autofills parcel delivery fee from township pricing and submits COD details", async () => {
    const user = userEvent.setup();
    renderInSheet(<CreateParcelForm merchants={[testMerchant()]} townships={[testTownship()]} />);

    expect(screen.getByLabelText("Merchant")).toBeTruthy();
    expect(screen.getByLabelText("Receiver name")).toBeTruthy();
    expect(screen.getByLabelText("Receiver township")).toBeTruthy();
    expect(screen.getByLabelText("Delivery fee")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Cash on delivery" })).toBeTruthy();
    expect(getButton("Create Parcel").disabled).toBe(false);

    await chooseComboboxOption("Select merchant", "Test Shop");
    await user.type(screen.getByLabelText("Receiver name"), "Receiver");
    await user.type(screen.getByLabelText("Receiver phone number"), "09123456789");
    await user.type(screen.getByLabelText("Receiver address"), "Receiver address");
    await chooseComboboxOption("Select receiver township", "Yangon");
    expect(getInput("Delivery fee").value).toBe("2000");

    await user.click(screen.getByRole("checkbox", { name: "Cash on delivery" }));
    await user.type(screen.getByLabelText("COD amount"), "10000");
    await user.click(screen.getByRole("button", { name: "Parcel dimensions" }));
    await user.type(screen.getByLabelText("Estimated weight"), "4");
    await user.type(screen.getByLabelText("Width"), "12");
    await user.click(getButton("Create Parcel"));
    await screen.findByText("Receiver's parcel has been created.");

    expect(createParcelActionMock).toHaveBeenCalledWith({
      merchantId: "merchant-id",
      receiverName: "Receiver",
      receiverPhoneNumber: "09123456789",
      receiverAddress: "Receiver address",
      specialNotes: "",
      townshipId: "township-id",
      deliveryFee: "2000",
      hasCod: true,
      codAmount: "10000",
      dimensions: {
        estimatedWeight: "4",
        width: "12",
        height: "",
        length: "",
      },
    });
  });

  test("submits parcel edit updates without changing parcel workflow fields", async () => {
    const user = userEvent.setup();
    renderInSheet(
      <EditParcelForm
        parcel={buildParcelListItem({
          id: "00000000-0000-4000-8000-000000000001",
          merchantId: "merchant-id",
          townshipId: "township-id",
          parcelType: "cod",
          status: "on_the_way",
          weightKg: 3,
        })}
        merchants={[testMerchant()]}
        townships={[testTownship()]}
      />,
    );

    await user.click(getButton("Save Changes"));

    expect(updateParcelActionMock).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000001",
      merchantId: "merchant-id",
      receiverName: "Receiver",
      receiverPhoneNumber: "09123456789",
      receiverAddress: "Receiver address",
      specialNotes: "",
      townshipId: "township-id",
      deliveryFee: "2000",
      hasCod: true,
      codAmount: "10000",
      dimensions: {
        estimatedWeight: "3",
        width: "",
        height: "",
        length: "",
      },
    });
  });

  function renderInSheet(children: ReactNode) {
    return render(
      <Sheet open>
        <SheetContent>{children}</SheetContent>
      </Sheet>,
    );
  }
});

function getButton(name: string) {
  const element = screen.getByRole("button", { name });

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`${name} is not a button.`);
  }

  return element;
}

function getInput(label: string) {
  const element = screen.getByLabelText(label);

  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
    throw new Error(`${label} is not an input.`);
  }

  return element;
}

async function chooseSelectOption(label: string, optionName: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(label));
  await user.click(screen.getByRole("option", { name: optionName }));
}

async function chooseComboboxOption(label: string, optionName: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(label), optionName);
  await user.click(screen.getByRole("option", { name: new RegExp(optionName, "i") }));
}

function testTownship() {
  return {
    id: "township-id",
    name: "Yangon",
    baseFee: 2_000,
    baseWeightKg: 3,
    extraWeightFee: 500,
    extraWeightUnitKg: 1,
    volumetricDivisor: 5000,
    codFeePercent: 0,
    returnFeePercent: 100,
    isActive: true,
  };
}

function testMerchant() {
  return {
    id: "merchant-id",
    shopName: "Test Shop",
    ownerName: "Merchant Owner",
    phoneNumber: "09999999999",
    address: "Merchant Address",
    pendingPayment: 0,
    parcelCount: 0,
  };
}
