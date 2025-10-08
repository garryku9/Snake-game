import '../styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import type {AppProps} from 'next/app';

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {WagmiProvider} from 'wagmi';
import {RainbowKitProvider} from '@rainbow-me/rainbowkit';

import {config} from '../wagmi';
import {GetSiweMessageOptions, RainbowKitSiweNextAuthProvider} from '@rainbow-me/rainbowkit-siwe-next-auth';
import type {Session} from 'next-auth';
import {SessionProvider} from 'next-auth/react';

const client = new QueryClient();
const getSiweMessageOptions: GetSiweMessageOptions = () => ({
    statement: 'Sign in to my RainbowKit app',
});
function MyApp({Component, pageProps}: AppProps<{
    session: Session;
}>) {

    return (
        <WagmiProvider config={config}>
            <SessionProvider refetchInterval={0} session={pageProps.session}>

                <QueryClientProvider client={client}>
                    <RainbowKitSiweNextAuthProvider getSiweMessageOptions={getSiweMessageOptions}>

                        <RainbowKitProvider>
                            <Component {...pageProps} />
                        </RainbowKitProvider>
                    </RainbowKitSiweNextAuthProvider>
                </QueryClientProvider>
            </SessionProvider>
        </WagmiProvider>
    );
}

export default MyApp;
