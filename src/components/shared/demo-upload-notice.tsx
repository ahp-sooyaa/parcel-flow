import { ImageOff } from "lucide-react";

export function DemoUploadNotice({ label, item }: { label: string; item: string }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{label}</div>
      <div
        className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-secondary/40 px-4 py-5 text-center"
        data-testid="demo-upload-notice"
      >
        <ImageOff className="size-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Uploads are off in the public demo. A sample {item} is attached for you.
        </span>
      </div>
    </div>
  );
}
