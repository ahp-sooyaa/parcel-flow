"use client";

type ParcelImageListProps = {
    title: string;
    images: Array<{
        key: string;
        url: string;
    }>;
    emptyMessage?: string;
};

export function ParcelImageList({
    title,
    images,
    emptyMessage = "No images uploaded.",
}: Readonly<ParcelImageListProps>) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>

            {images.length === 0 ? (
                <p className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                    {emptyMessage}
                </p>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {images.map((image, index) => (
                        <a
                            key={image.key}
                            href={image.url}
                            target="_blank"
                            rel="noreferrer"
                            className="space-y-2 rounded-lg border bg-background p-3 transition hover:border-foreground/30"
                        >
                            <img
                                src={image.url}
                                alt={`${title} ${index + 1}`}
                                className="h-36 w-full rounded-md object-cover"
                            />
                            <p className="truncate text-xs text-muted-foreground">
                                Image {index + 1}
                            </p>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
