import { EvmChain } from "@moralisweb3/common-evm-utils";
import Moralis from "moralis";
import { config } from "dotenv"

config()

export interface TokenDetails {
  tokenName:               string;
  tokenSymbol:             string;
  tokenLogo:               string;
  tokenDecimals:           string;
  nativePrice:             string;
  usdPrice:                number;
  usdPriceFormatted:       string;
  exchangeName:            string;
  exchangeAddress:         string;
  tokenAddress:            string;
  priceLastChangedAtBlock: string;
  possibleSpam:            boolean;
  verifiedContract:        boolean;
  "24hrPercentChange":     string;
}



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
  contractAddress?: string ,
) {
  let eth = false
  let chain = EvmChain.ARBITRUM;

  if (!contractAddress) {
    eth = true
  contractAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
    chain = EvmChain.ETHEREUM
  }
  console.log({contractAddress, chain: chain.name})

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
try {


  const response = await Moralis.EvmApi.token.getTokenPrice({
    chain,
    include: "percent_change",
    address: contractAddress,
  });

  const priceData = response.result;
  if(eth) priceData.tokenLogo = "https://i.ibb.co/Mg8Yd81/eth.png";
  // fs.writeFileSync('token.json', JSON.stringify(priceData))
  return priceData as unknown as TokenDetails;
} catch (error) {
  console.log({ error })
  return null
}
}

export function convertTokenAmountToUSD(numberOfTokens: number, tokenPriceData: any) {
  if(!tokenPriceData) return 0
  const amount = numberOfTokens * tokenPriceData.usdPrice;
  return amount;
}

export function getEthPrice(nativePrice: string, usdPrice: number, ethAmount: number){
  const nativePriceInETH = BigInt(nativePrice) / BigInt("1000000000000000000");
  const ethAmountInUsd = (usdPrice / Number(nativePriceInETH)) * 1e18 * ethAmount
  return ethAmountInUsd
}


