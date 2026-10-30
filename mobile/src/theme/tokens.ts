// Design tokens from the front matter of DESIGN.md, the same system the web app
// uses. The status colors are not in DESIGN.md: danger matches the web app's
// `--destructive`, warning is a quiet amber, success uses DESIGN.md's teal, and
// progress is a pale tint of the primary indigo.
export const colors = {
  primary: "#1b1938",
  primaryDeep: "#0e0c1f",
  onPrimary: "#ffffff",
  ink: "#292827",
  inkMute: "#73706d",
  inkFaint: "#9a9794",
  canvas: "#ffffff",
  canvasSoft: "#fafaf8",
  hairline: "#e8e4dd",
  danger: "#e7000b",
  dangerSoft: "#fdecec",
  warningInk: "#92400e",
  warningSoft: "#fef3c7",
  successInk: "#155555",
  successSoft: "#e3f1ec",
  progressSoft: "#e8e6f5",
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 64,
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const typography = {
  displayMd: { fontSize: 22, fontWeight: "600", lineHeight: 24, letterSpacing: -0.3 },
  headingLg: { fontSize: 20, fontWeight: "600", lineHeight: 24, letterSpacing: -0.4 },
  bodyMd: { fontSize: 16, fontWeight: "400", lineHeight: 24 },
  buttonMd: { fontSize: 16, fontWeight: "700", lineHeight: 16 },
  caption: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  micro: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
} as const;
