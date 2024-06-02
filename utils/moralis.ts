import { EvmChain } from "@moralisweb3/common-evm-utils";
import Moralis from "moralis";
import { config } from "dotenv"
import fs from 'fs'

config()


const chain = EvmChain.ARBITRUM;

export function formatCurrency(
  input: number,
  maxInteger: number = 13,
  decimalPlaces = 2
) {
  let inputStr = input.toString();

  if (Number.isInteger(input)) {
    if (inputStr.length > maxInteger) {
      return input.toExponential(2);
    }
    return inputStr;
  }

  inputStr = input.toFixed(decimalPlaces).toString();

  // Separate integer and decimal parts
  let parts = inputStr.split(".");
  let integerPart = parts[0];

  if (integerPart.length > maxInteger - decimalPlaces) {
    return Number(integerPart).toExponential(2);
  }

  return inputStr;
}

export async function getTokenPrice(
  contractAddress = "0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3"
) {
  const moralisApiKey = process.env.MORALIS_API_KEY;
  if (!moralisApiKey) {
    throw new Error("Moralis api key missing");
  }

  if (!Moralis.Core.isStarted) {
    console.log("I will start moralis");
    await Moralis.start({
      apiKey: moralisApiKey,
      // ...and any other configuration
    });
  }

  const response = await Moralis.EvmApi.token.getTokenPrice({
    chain,
    include: "percent_change",
    address: contractAddress,
  });

  const priceData = response.result;
  fs.writeFileSync('token.json', JSON.stringify(priceData))
  return priceData;
}

export async function convertTokenAmountToUSD(numberOfTokens: number) {
  const tokenPriceData = await getTokenPrice();
  const amount = numberOfTokens * tokenPriceData.usdPrice;
  return amount;
}

