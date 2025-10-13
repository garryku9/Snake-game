import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
 monadTestnet
} from 'wagmi/chains';
import {publicActions} from "viem";

export const config = getDefaultConfig({
  appName: 'Smart Accounts',
  projectId: '901948d0329817ffc3f340971fb8022c',
  chains: [
      monadTestnet,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [] : []),
  ],
  ssr: true,
});
export const publicClient = config.getClient().extend(publicActions);