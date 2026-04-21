import type { Instrumentation } from "next";

function getErrorDetails(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            digest:
                "digest" in error && typeof error.digest === "string" ? error.digest : undefined,
        };
    }

    return {
        name: "UnknownError",
        message: String(error),
        stack: undefined,
        digest: undefined,
    };
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
    console.error(
        "[request-error]",
        JSON.stringify({
            error: getErrorDetails(error),
            request: {
                method: request.method,
                path: request.path,
            },
            context,
        }),
    );
};
