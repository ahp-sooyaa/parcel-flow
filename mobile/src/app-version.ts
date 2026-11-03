import * as Application from "expo-application";

type AppVersionInput = {
  isDev: boolean;
  version: string | null;
  build: string | null;
};

/**
 * The installed build's version for the Profile screen, so testers can say
 * which build they're on. In Expo Go the native values are Expo Go's own.
 */
export function formatAppVersion({ isDev, version, build }: AppVersionInput): string {
  if (isDev) {
    return "Development build";
  }

  if (!version) {
    return "Version unknown";
  }

  return build ? `Version ${version} (build ${build})` : `Version ${version}`;
}

export function appVersionLabel(): string {
  return formatAppVersion({
    isDev: __DEV__,
    version: Application.nativeApplicationVersion,
    build: Application.nativeBuildVersion,
  });
}
