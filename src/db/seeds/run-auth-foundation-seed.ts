import { seedAuthFoundation } from "./auth-foundation";

async function main() {
  const result = await seedAuthFoundation();

  // eslint-disable-next-line no-console
  console.log("Auth foundation seed complete", result);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
