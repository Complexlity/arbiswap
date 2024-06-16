import { ZeroxSwapPriceData, ZeroxSwapQuoteOrder } from "./types.js";
import { Redis } from "@upstash/redis";
import z from "zod";
import { config } from
 "dotenv";
config();
  import { customAlphabet } from "nanoid";

const envSchema = z.object({
  REDIS_URL: z.string().url(),
  REDIS_TOKEN: z.string(),
  ZEROX_API_KEY: z.string(),
  MORALIS_API_KEY: z.string(),
  PINATA_JWT: z.string(),
  PINATA_GATEWAY: z.string(),
});

type EnvSchemaType = z.infer<typeof envSchema>;

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvSchemaType {}
  }
}
let parsedEnv = envSchema.parse(process.env);



const ZEROX_API_KEY = parsedEnv.ZEROX_API_KEY;

export const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', 7)

export const kvStore = new Redis({
  url: parsedEnv.REDIS_URL,
  token: parsedEnv.REDIS_TOKEN,
});


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
