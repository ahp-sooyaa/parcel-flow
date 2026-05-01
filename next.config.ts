import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactCompiler: true,
    allowedDevOrigins: ["127.0.0.1", "http://localhost:3000"],
    poweredByHeader: false,
    serverExternalPackages: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=31536000; includeSubDomains",
                    },
                    {
                        key: "X-Frame-Options",
                        value: "SAMEORIGIN",
                    },
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "strict-origin-when-cross-origin",
                    },
                    {
                        key: "Permissions-Policy",
                        value: [
                            "accelerometer=()",
                            "autoplay=()",
                            "camera=()",
                            "display-capture=()",
                            "encrypted-media=()",
                            "fullscreen=(self)",
                            "geolocation=()",
                            "gyroscope=()",
                            "microphone=()",
                            "payment=()",
                            "picture-in-picture=()",
                            "publickey-credentials-get=()",
                            "usb=()",
                        ].join(", "),
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
