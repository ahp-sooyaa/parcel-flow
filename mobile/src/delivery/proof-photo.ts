import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/** Long enough to read a label or doorway when zoomed in, small enough for mobile data. */
export const PROOF_PHOTO_MAX_EDGE = 1600;
export const PROOF_PHOTO_JPEG_QUALITY = 0.7;

export type ProofPhoto = { uri: string; width: number; height: number };

export type ProofPhotoResult =
  | { status: "picked"; photo: ProofPhoto }
  | { status: "canceled" }
  | { status: "denied" };

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 1,
  exif: false,
};

/** Opens the camera. Returns `denied` when the rider refuses camera access. */
export async function takeProofPhoto(): Promise<ProofPhotoResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    return { status: "denied" };
  }

  return toResult(await ImagePicker.launchCameraAsync(pickerOptions));
}

/** Opens the gallery. Android's system photo picker needs no permission. */
export async function chooseProofPhoto(): Promise<ProofPhotoResult> {
  return toResult(await ImagePicker.launchImageLibraryAsync(pickerOptions));
}

async function toResult(result: ImagePicker.ImagePickerResult): Promise<ProofPhotoResult> {
  const asset = result.canceled ? undefined : result.assets[0];

  if (!asset) {
    return { status: "canceled" };
  }

  return { status: "picked", photo: await prepareProofPhoto(asset) };
}

/**
 * Shrinks the photo so its long edge is at most 1600 px (never upscaling) and
 * re-encodes it as JPEG. The output has no EXIF data, so no location.
 */
export async function prepareProofPhoto(asset: {
  uri: string;
  width: number;
  height: number;
}): Promise<ProofPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  const longEdge = Math.max(asset.width, asset.height);

  if (longEdge > PROOF_PHOTO_MAX_EDGE) {
    context.resize(
      asset.width >= asset.height
        ? { width: PROOF_PHOTO_MAX_EDGE }
        : { height: PROOF_PHOTO_MAX_EDGE },
    );
  }

  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    compress: PROOF_PHOTO_JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });

  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/**
 * The proof photo as a multipart file part. Expo's `fetch` doesn't accept React
 * Native's `{ uri, name, type }` parts; it reads any part with a `bytes()`
 * method, so the file is read through expo-file-system with a fixed name and type.
 */
export function proofPhotoUploadPart(photo: ProofPhoto) {
  const file = new File(photo.uri);

  return {
    name: "proof.jpg",
    type: "image/jpeg",
    bytes: () => file.bytes(),
  };
}
