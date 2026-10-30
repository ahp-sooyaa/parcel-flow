// @ts-check
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The API contract lives in the web app (src/features/mobile-api/contract.ts)
// so the server and the app share one set of schemas.
const contractDir = path.resolve(__dirname, "../src/features/mobile-api");
const contractFile = path.join(contractDir, "contract.ts");

config.watchFolders = [...(config.watchFolders ?? []), contractDir];

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;

  if (moduleName === "@parcel-flow/contract") {
    return { type: "sourceFile", filePath: contractFile };
  }

  // Resolve the contract's own imports (zod) from this app's node_modules,
  // not the web app's, so the bundle carries a single copy.
  if (context.originModulePath.startsWith(contractDir) && !moduleName.startsWith(".")) {
    return resolve(
      { ...context, originModulePath: path.join(__dirname, "package.json") },
      moduleName,
      platform,
    );
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
