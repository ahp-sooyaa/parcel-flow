import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import {
  chooseProofPhoto,
  prepareProofPhoto,
  proofPhotoUploadPart,
  takeProofPhoto,
} from "@/delivery/proof-photo";

const resize = jest.fn();
const saveAsync = jest.fn(async () => ({ uri: "file:///out.jpg", width: 1200, height: 1600 }));

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: { manipulate: jest.fn() },
}));

const mockFileBytes = new Uint8Array([0xff, 0xd8, 0xff]);

jest.mock("expo-file-system", () => ({
  File: jest.fn((uri: string) => ({ uri, bytes: jest.fn(async () => mockFileBytes) })),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

beforeEach(() => {
  resize.mockReset();
  saveAsync.mockClear();
  const context = { resize, renderAsync: jest.fn(async () => ({ saveAsync })) };
  resize.mockReturnValue(context);
  jest.mocked(ImageManipulator.manipulate).mockReturnValue(context as never);
});

describe("prepareProofPhoto", () => {
  it("shrinks a portrait photo's height to 1600 px and saves JPEG at 0.7", async () => {
    await expect(
      prepareProofPhoto({ uri: "file:///in.jpg", width: 3000, height: 4000 }),
    ).resolves.toEqual({ uri: "file:///out.jpg", width: 1200, height: 1600 });

    expect(resize).toHaveBeenCalledWith({ height: 1600 });
    expect(saveAsync).toHaveBeenCalledWith({ compress: 0.7, format: SaveFormat.JPEG });
  });

  it("shrinks a landscape photo's width", async () => {
    await prepareProofPhoto({ uri: "file:///in.jpg", width: 4000, height: 3000 });

    expect(resize).toHaveBeenCalledWith({ width: 1600 });
  });

  it("never upscales a small photo, but still re-encodes it", async () => {
    await prepareProofPhoto({ uri: "file:///in.jpg", width: 800, height: 600 });

    expect(resize).not.toHaveBeenCalled();
    expect(saveAsync).toHaveBeenCalled();
  });
});

describe("takeProofPhoto and chooseProofPhoto", () => {
  it("reports a denied camera without opening it", async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
      granted: false,
    } as never);

    await expect(takeProofPhoto()).resolves.toEqual({ status: "denied" });
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("asks for images without EXIF and prepares the picked photo", async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
      granted: true,
    } as never);
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///in.jpg", width: 3000, height: 4000 }],
    } as never);

    await expect(takeProofPhoto()).resolves.toEqual({
      status: "picked",
      photo: { uri: "file:///out.jpg", width: 1200, height: 1600 },
    });
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      quality: 1,
      exif: false,
    });
  });

  it("reports a canceled gallery pick", async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    } as never);

    await expect(chooseProofPhoto()).resolves.toEqual({ status: "canceled" });
  });
});

describe("proofPhotoUploadPart", () => {
  it("names the part proof.jpg and reads the saved photo's bytes", async () => {
    const part = proofPhotoUploadPart({ uri: "file:///out.jpg", width: 1200, height: 1600 });

    expect(part.name).toBe("proof.jpg");
    expect(part.type).toBe("image/jpeg");
    await expect(part.bytes()).resolves.toBe(mockFileBytes);
    expect(File).toHaveBeenCalledWith("file:///out.jpg");
  });
});
