import { seedSuperAdmin } from "./super-admin";

async function main() {
    const result = await seedSuperAdmin();

    // eslint-disable-next-line no-console
    console.log("Super admin seed complete", result);
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
