import { syncAuthFoundationSeed } from "./auth-foundation";

async function main() {
  const result = await syncAuthFoundationSeed();

  // eslint-disable-next-line no-console
  console.log("Auth foundation seed complete", result);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
