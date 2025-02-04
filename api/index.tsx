/** @jsxImportSource frog/jsx */

import {
  Button,
  FrameContext,
  Frog,
  TextInput,
  TransactionContext,
} from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";

// import { neynar } from 'frog/hubs'
import { handle } from "frog/vercel";
import { Address, parseAbi, parseEther, parseUnits } from "viem";
import {
  TokenDetails,
  convertTokenAmountToUSD,
  formatCurrency,
  getEthPrice,
  getTokenPrice,
} from "../utils/token.js";
import { imageUrls } from "../utils/images.js";
import { createPublicClient, http } from "viem";
import { arbitrum } from "viem/chains";
import fs from "fs";
import { ZeroxSwapPriceData, ZeroxSwapQuoteOrder } from "../utils/types.js";
import { fdk } from "../utils/pinata.js";
import { BlankInput } from "hono/types";

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }
const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

const DEFAULT_TOKEN_CA = "0x912ce59144191c1204e64559fe8253a0e49e6548"

type State = {
  order: any;
};

export const app = new Frog<{ State: State }>({
  assetsPath: "/",
  basePath: "/api",
  initialState: {
    order: {},
  },
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
});

const analytics = fdk.analyticsMiddleware({
  frameId: "buy-tokens-on-arbitrum",
});

type StartFrameContext = FrameContext<
  {
    State: State;
  },
  "/",
  BlankInput
>;

async function handleTokenDetails(c: StartFrameContext, ca: string) {
  let token = await getTokenPrice(ca);

  return c.res({
    image: token ? <TokenCardDetails token={token} /> : <ErrorImage />,
    intents: token
      ? [
          <TextInput placeholder="Amount(in ETH). Default=0.01" />,
          <Button action={`/confirm/${ca}`}>Proceed</Button>,
          <Button.Reset>Back</Button.Reset>,
        ]
      : [
          <TextInput placeholder="Enter contract address" />,
          <Button>Retry</Button>,
          <Button.Reset>Home</Button.Reset>,
        ],
  });
}


app.frame("/", analytics, async (c: StartFrameContext) => {
  return c.res({
    // image: "https://i.postimg.cc/Kv3j32RY/start.png",
    image: "https://i.postimg.cc/CxytCWs7/start.png",
    intents: [
      <TextInput placeholder="Enter Contract Address e.g: 0x.." />,
      <Button action="/token">Go</Button>,
      <Button.Link href="https://dexscreener.com/arbitrum">
        All Tokens
      </Button.Link>,
    ],
  });
});


app.frame("/token", analytics, async (c: StartFrameContext) => {
  const { inputText } = c;
  let ca = inputText
    if(!ca) ca  = DEFAULT_TOKEN_CA;
  console.log({ca})
  return handleTokenDetails(c, ca);
});
app.frame("/exact_token/:ca", analytics, async (c: StartFrameContext) => {
  let ca = c.req.param("ca");
  if (!ca) ca = DEFAULT_TOKEN_CA
  return handleTokenDetails(c, ca);
});

app.frame("/confirm/:ca", analytics, async (c: StartFrameContext) => {
  const ca = c.req.param("ca");
  if (!ca) throw new Error("Contract address missing");
  let { inputText: ethAmount } = c;
  let ethAmountAsNumber = Number(ethAmount);
  if (isNaN(ethAmountAsNumber) || ethAmountAsNumber == 0 || !ethAmount) {
    ethAmount = "0.01";
    ethAmountAsNumber = Number(ethAmount);
  }


  const baseUrl = `https://arbitrum.api.0x.org/swap/v1/price?`;
  const eth = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  let tokenPriceData = await getTokenPrice(ca);

  const params = new URLSearchParams({
    buyToken: ca,
    sellToken: eth,
    sellAmount: parseEther(ethAmount).toString(),
  }).toString();

  const res = await fetch(baseUrl + params, {
    headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" },
  });

  const priceData = (await res.json()) as ZeroxSwapPriceData;

  const tokenAmountReceived = `${Number(priceData.price) * Number(ethAmount)}`;
  const ethAmountInUsd = getEthPrice(
    tokenPriceData?.nativePrice!,
    tokenPriceData?.usdPrice!,
    ethAmountAsNumber
  );

  return c.res({
    action: "/finish",
    image: (
      <PreviewImage
        ethInUsd={ethAmountInUsd}
        token={tokenPriceData!}
        amountInEth={ethAmount}
        amountReceived={tokenAmountReceived}
      />
    ),
    intents: [
      <Button.Transaction target={`/tx/${ca}/${ethAmount}`}>
        Confirm
      </Button.Transaction>,
      <Button action={`/exact_token/${ca}`}>Back</Button>,
    ],
  });
});

type StartTransactionContext = TransactionContext<
  {
    State: State;
  },
  "/tx/:ca/:amount",
  BlankInput
>;

app.transaction(
  "/tx/:ca/:amount",
  analytics,
  async (c: StartTransactionContext) => {
    const ca = c.req.param("ca");
    const amount = c.req.param("amount");

    if (!ca || !amount) throw new Error("Missing Contract address or Amount");
    // prettier-ignore

    const baseUrl = `https://arbitrum.api.0x.org/swap/v1/quote?`

    const eth = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

    const params = new URLSearchParams({
      buyToken: ca,
      sellToken: eth,
      sellAmount: parseEther(amount).toString(),
      feeRecipient: "0x8ff47879d9eE072b593604b8b3009577Ff7d6809",
      buyTokenPercentageFee: "0.01",
    }).toString();

    const res = await fetch(baseUrl + params, {
      headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" },
    });

    const order = (await res.json()) as ZeroxSwapQuoteOrder;

    return c.send({
      chainId: `eip155:42161`,
      to: order.to,
      data: order.data,
      value: BigInt(order.value),
    });
  }
);

app.frame("/finish", analytics, async (c: StartFrameContext) => {
  const { transactionId, frameData } = c;
  console.log("User transacted", frameData?.fid);

  return c.res({
    image: "https://pbs.twimg.com/media/F4M9IOlWwAEgTDf.jpg",
    intents: [
      <Button.Link href={`https://arbiscan.io/tx/${transactionId}`}>
        View Transaction
      </Button.Link>,
      <Button.Reset>Home</Button.Reset>,
    ],
  });
});

function PreviewImage({
  amountReceived,
  token,
  amountInEth,
  ethInUsd,
}: {
  ethInUsd: number;
  amountInEth: string;
  amountReceived: string;
  token: TokenDetails;
}) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        fontSize: 32,
        fontWeight: 600,
        padding: "10px 50px",
      }}
      tw="bg-slate-900 text-white"
    >
      <span tw="text-6xl my-4">Preview Transaction </span>
      <div
        tw="flex items-center  mx-auto justify-between max-w-4/5 w-full flex-col"
        style={{
          gap: "10px",
        }}
      >
        <div tw="flex justify-between py-2  w-full px-4">
          <span tw="text-center text-gray-500 flex">From</span>
          <span tw="text-center text-gray-500">To</span>
        </div>
        <div tw="flex justify-between py-2  w-full">
          <div tw="rounded-full flex w-[100px] h-[100px] overflow-hidden ">
            <img
              src="https://i.ibb.co/Mg8Yd81/eth.png"
              // src={eth.tokenLogo}
              width={"100%"}
              height={"100%"}
              style={{
                objectFit: "cover",
              }}
            />
          </div>
          <span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="100"
              height="100"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 8L22 12L18 16" />
              <path d="M2 12H22" />
            </svg>{" "}
          </span>
          <div tw="rounded-full flex w-[100px] h-[100px] overflow-hidden ">
            <img
              // src="https://i.imgur.com/mt3nbeI.jpg"
              src={token.tokenLogo}
              width={"100%"}
              height={"100%"}
              style={{
                objectFit: "cover",
              }}
            />
          </div>
        </div>

        <div tw="flex w-full justify-between px-4">
          <span>ETH</span>
          <span>{token.tokenSymbol}</span>
        </div>
      </div>
      <hr tw="py-[1px] w-full bg-gray-800" />

      <div tw="flex justify-between py-2">
        <div tw="text-gray-400">You spend</div>
        <div tw="flex text-4xl items-center" style={{ gap: "4px" }}>
          {/* <img src={token.tokenLogo} width={50} height={50} /> */}
          <span>You receive</span>
        </div>
      </div>
      <div tw="flex justify-between py-2">
        <span tw="text-gray-400 flex gap-2">{`${amountInEth} ETH ($${ethInUsd.toFixed(
          2
        )})`}</span>
        <span tw="text-4xl flex" style={{ gap: "5px" }}>
          <span>{Number(amountReceived).toFixed(2)} </span>
          <span>{token.tokenSymbol}</span>
        </span>
      </div>

      <div tw="flex justify-between py-2 items-center">
        <span tw="text-gray-400">Chain</span>
        <span style={{ gap: "4px" }} tw="flex items-center">
          <img
            src="https://i.ibb.co/BrQLkcw/arbitrum-arb-logo.png"
            width={50}
            height={50}
          />
          <span>Arbitrum</span>
        </span>
      </div>
    </div>
  );
}


function ErrorImage() {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
        fontSize: 32,
        fontWeight: 600,
      }}
    >
      <img
        tw="absolute inset-0"
        src="https://i.postimg.cc/CxytCWs7/start.png"
        width="100%"
        height="100%"
      />
      <p tw="absolute top-0 left-10 text-red-600 font-bold text-4xl">
        Token Not Found. Enter a different address.
      </p>
    </div>
  );
}

function TokenCardDetails({ token }: { token: TokenDetails }) {
  const percentChange = Number(token?.["24hrPercentChange"]);

  return (
    <div
      tw="flex w-full h-full flex-col "
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgb(0, 124, 240), rgb(0, 223, 216))",
      }}
    >
      <div tw="flex flex-1 justify-between px-16">
        <div tw="w-1/2 flex  relative">
          <div
            style={{
              gap: "1rem",
            }}
            tw="flex flex-col absolute bottom-4  text-white gap-4"
          >
            <span tw="text-7xl font-semibold">{token?.tokenName}</span>
            <span tw="text-5xl">${token?.tokenSymbol}</span>
          </div>
        </div>
        <div tw="flex w-1/2 items-center ">
          <div tw="flex mx-auto w-[26rem]  content-center rounded-full overflow-hidden">
            <img src={token?.tokenLogo} tw="object-cover w-full" width="100%" />
          </div>
        </div>
      </div>
      <div tw="px-16 flex items-center justify-between bg-white h-[30%]">
        <div
          style={{
            gap: "2rem",
          }}
          tw="flex flex-1 flex-col"
        >
          <div style={{ gap: "4px" }} tw="flex items-end">
            <span tw="text-5xl font-bold">
              {token?.usdPrice.toFixed(7)} USD
            </span>
            <span tw="text-4xl text-gray-600">{`/${token?.tokenSymbol}`}</span>
          </div>
          <div tw="flex items-end">
            <span tw="text-4xl text-gray-900 font-bold">
              {`${(Number(token?.nativePrice) / 1e36).toFixed(7)}`} ETH
            </span>
            <span tw="text-2xl text-gray-600">{`/${token?.tokenSymbol}`}</span>
          </div>
        </div>
        <div
          style={{
            gap: "1rem",
          }}
          tw={`flex text-6xl  items-center justify-end ${
            percentChange > 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {percentChange > 0 ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="100"
              height="100"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m18 15-6-6-6 6"></path>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="100"
              height="100"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          )}

          <p>{percentChange.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
}

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
