import { ZeroxSwapPriceData, ZeroxSwapQuoteOrder } from "./types.js";
import { config } from "dotenv";
config();

const ZEROX_API_KEY = process.env.ZEROX_API_KEY;

export async function zeroxSDK(
  type: "price" | "quote",
  params: URLSearchParams,
  chain: "arbitrum" | "base" | "optimism" | "" = ""
): Promise<ZeroxSwapPriceData | ZeroxSwapQuoteOrder> {
  let data: ZeroxSwapPriceData | ZeroxSwapQuoteOrder;
  const baseUrl = `https://${
    chain ? chain + "." : ""
  }api.0x.org/swap/v1/${type}?`;
  console.log(baseUrl + params);
	const res = await fetch(baseUrl + params.toString(), {
		//@ts-expect-error
    headers: { "0x-api-key": ZEROX_API_KEY },
  });

  if (type === "quote") {
    data = (await res.json()) as ZeroxSwapPriceData;
    return data;
  } else if (type === "price") {
    data = (await res.json()) as ZeroxSwapQuoteOrder;
    return data;
  }
  throw new Error("Wrong type");
}
