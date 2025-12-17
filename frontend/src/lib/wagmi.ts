import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "CS2 Major Fan Consensus Protocol",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [sepolia],
  ssr: true,
});
