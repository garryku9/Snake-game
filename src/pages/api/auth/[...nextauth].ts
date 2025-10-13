import type { IncomingMessage } from "node:http";
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getCsrfToken } from "next-auth/react";
import {
    type SiweMessage,
    parseSiweMessage,
    validateSiweMessage,
} from "viem/siwe";

import { publicClient } from "../../../wagmi";

export function getAuthOptions(req: IncomingMessage): NextAuthOptions {
    const providers = [
        CredentialsProvider({
            async authorize(credentials: any) {
                const startTime = Date.now();
                console.log("🔐 Starting SIWE authentication...");

                try {
                    const siweMessage = parseSiweMessage(
                        credentials?.message
                    ) as SiweMessage;

                    if (
                        !validateSiweMessage({
                            address: siweMessage?.address,
                            message: siweMessage,
                        })
                    ) {
                        console.log("❌ SIWE message validation failed");
                        return null;
                    }

                    // Debug: Log environment variables
                    console.log("🔍 Environment Check:");
                    console.log("  NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
                    console.log("  VERCEL_URL:", process.env.VERCEL_URL);
                    console.log("  NODE_ENV:", process.env.NODE_ENV);

                    const nextAuthUrl =
                        process.env.NEXTAUTH_URL ||
                        (process.env.VERCEL_URL
                            ? `https://${process.env.VERCEL_URL}`
                            : null);

                    console.log("  Computed nextAuthUrl:", nextAuthUrl);

                    if (!nextAuthUrl) {
                        console.log("❌ No NEXTAUTH_URL or VERCEL_URL found");
                        return null;
                    }

                    const nextAuthHost = new URL(nextAuthUrl).host;
                    console.log("  nextAuthHost:", nextAuthHost);
                    console.log("  siweMessage.domain:", siweMessage.domain);

                    if (siweMessage.domain !== nextAuthHost) {
                        console.log("❌ Domain mismatch!");
                        console.log(`  Expected: ${nextAuthHost}`);
                        console.log(`  Got: ${siweMessage.domain}`);
                        return null;
                    }

                    const csrfToken = await getCsrfToken({ req: { headers: req.headers } });
                    console.log("  CSRF Token:", csrfToken?.substring(0, 10) + "...");
                    console.log("  SIWE Nonce:", siweMessage.nonce?.substring(0, 10) + "...");

                    if (siweMessage.nonce !== csrfToken) {
                        console.log("❌ Nonce mismatch!");
                        return null;
                    }

                    console.log("⏱️ Verifying signature...");
                    const verifyStart = Date.now();

                    const valid = await publicClient.verifyMessage({
                        address: siweMessage?.address,
                        message: credentials?.message,
                        signature: credentials?.signature,
                    });

                    const verifyTime = Date.now() - verifyStart;
                    console.log(`✅ Signature verification took ${verifyTime}ms`);

                    if (!valid) {
                        console.log("❌ Signature verification failed");
                        return null;
                    }

                    const totalTime = Date.now() - startTime;
                    console.log(
                        `🎉 Authentication successful! Total time: ${totalTime}ms`
                    );

                    return {
                        id: siweMessage.address,
                    };
                } catch (e) {
                    const totalTime = Date.now() - startTime;
                    console.error(`❌ Authentication failed after ${totalTime}ms:`, e);
                    return null;
                }
            },
            credentials: {
                message: {
                    label: "Message",
                    placeholder: "0x0",
                    type: "text",
                },
                signature: {
                    label: "Signature",
                    placeholder: "0x0",
                    type: "text",
                },
            },
            name: "Ethereum",
        }),
    ];

    return {
        callbacks: {
            async session({ session, token }) {
                session.address = token.sub;
                session.user = {
                    name: token.sub,
                };
                return session;
            },
        },
        providers,
        secret: process.env.NEXTAUTH_SECRET,
        session: {
            strategy: "jwt",
        },
    };
}

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
    // Debug: Log when auth endpoint is hit
    console.log("🚀 Auth endpoint called:", req.method, req.query.nextauth);

    const authOptions = getAuthOptions(req);

    if (!Array.isArray(req.query.nextauth)) {
        res.status(400).send("Bad request");
        return;
    }

    const isDefaultSigninPage =
        req.method === "GET" &&
        req.query.nextauth.find((value) => value === "signin");

    if (isDefaultSigninPage) {
        authOptions.providers.pop();
    }

    return await NextAuth(req, res, authOptions);
}