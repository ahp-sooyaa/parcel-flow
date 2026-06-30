# Copy a completed run from `benchmarks/results/<timestamp>/` into this folder before optimization work.

Example:

```bash
cp -R benchmarks/results/2026-06-29T12-00-00Z benchmarks/baselines/pre-parcels-pagination
```

Compare after optimization:

```bash
bun run perf:compare benchmarks/baselines/pre-parcels-pagination benchmarks/results/<latest-run>
```

The compare command accepts either result directories or individual `dal.json` files.
