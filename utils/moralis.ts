import Moralis from "moralis";
import { EvmChain } from "@moralisweb3/common-evm-utils";
import { config } from "dotenv"

config()

export const variable = "bun bun"
export const moralisApiKey = process.env.MORALIS_API_KEY

console.log({moralisApiKey})
const runApp = async () => {
  await Moralis.start({
    apiKey: moralisApiKey,
    // ...and any other configuration
  });

  const address = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599";

  const chain = EvmChain.ETHEREUM;

  const response = await Moralis.EvmApi.token.getTokenPrice({
    address,
    chain,
  });

  console.log(response.toJSON());
};

// runApp();