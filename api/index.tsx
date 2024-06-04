/** @jsxImportSource frog/jsx */


import { Button, FrameContext, Frog, TextInput, TransactionContext } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'

// import { neynar } from 'frog/hubs'
import { handle } from 'frog/vercel'
import { Address, parseAbi, parseEther, parseUnits } from "viem";
import { TokenDetails, convertTokenAmountToUSD, formatCurrency, getEthPrice, getTokenPrice  } from '../utils/token.js'
import { imageUrls } from "../utils/images.js";
import { createPublicClient, http } from "viem";
import { arbitrum } from "viem/chains";
import fs from 'fs'
import { ZeroxSwapPriceData, ZeroxSwapQuoteOrder } from '../utils/types.js';
import { fdk } from "../utils/pinata.js";
import { BlankInput } from 'hono/types';


// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }
const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

type State = {
  order: any
}


export const app = new Frog<{ State: State }>({
  assetsPath: '/',
  basePath: '/api',
  initialState: {
    order: {
    }
  }
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
})

const analytics = fdk.analyticsMiddleware({
  frameId: "buy-tokens-on-arbitrum",
});

app.frame(
  "/",
  analytics,
  async (
    c: FrameContext<
      {
        State: State;
      },
      "/",
      BlankInput
    >
  ) => {
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
  }
);

async function handleTokenDetails(
  c: FrameContext<
    {
      State: State;
    },
    "/",
    BlankInput
  >,
  ca: string
) {
  let token = null;
  let usd = 42;
  if (ca) {
    token = await getTokenPrice(ca);
    usd = convertTokenAmountToUSD(100000, token) ?? "42";
  }

  console.log(token?.tokenLogo);
  // console.log({token, usd})
  return c.res({
    image: token ? <TokenCardDetails token={token} /> : <ErrorImage />,
    intents: token
      ? [
          <TextInput placeholder="Enter amount in eth" />,
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


app.frame(
  "/token",
  analytics,
  async (
    c: FrameContext<
      {
        State: State;
      },
      "/",
      BlankInput
    >
  ) => {
    const { inputText } = c;
    let ca = inputText ?? "0xD77B108d4f6cefaa0Cae9506A934e825BEccA46E";
    return handleTokenDetails(c, ca);
  }
);
app.frame(
  "/exact_token/:ca",
  analytics,
  async (
    c: FrameContext<
      {
        State: State;
      },
      "/",
      BlankInput
    >
  ) => {
    let ca = c.req.param("ca");
    if(!ca) throw new Error("Contract address missing")
    return handleTokenDetails(c, ca);
  }
);

app.frame(
  "/confirm/:ca",
  analytics,
  async (
    c: FrameContext<
      {
        State: State;
      },
      "/",
      BlankInput
    >
  ) => {
    const ca = c.req.param("ca");
    if (!ca) throw new Error("Contract address missing");
    let { inputText: ethAmount } = c;
    let ethAmountAsNumber = Number(ethAmount);
    if (isNaN(ethAmountAsNumber) || ethAmountAsNumber == 0 || !ethAmount) {
      ethAmount = "0.01";
      ethAmountAsNumber = Number(ethAmount);
    }

    console.log({ ethAmount });

    const baseUrl2 = `https://arbitrum.api.0x.org/swap/v1/price?`;
    const eth = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    let tokenPriceData = await getTokenPrice(ca);


    const params2 = new URLSearchParams({
      buyToken: ca,
      sellToken: eth,
      sellAmount: parseEther(ethAmount).toString(),
      // feeRecipient: "0x8ff47879d9eE072b593604b8b3009577Ff7d6809",
      // buyTokenPercentageFee: "0.01",
    }).toString();


    const res2 = await fetch(baseUrl2 + params2, {
      headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" },
    });

    const priceData = (await res2.json()) as ZeroxSwapPriceData;

    const tokenAmountReceived = `${
      Number(priceData.price) * Number(ethAmount)
    }`;
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
  }
);

app.transaction(
  "/tx/:ca/:amount",
  analytics,
  async (
    c: TransactionContext<
      {
        State: State;
      },
      "/tx/:ca/:amount",
      BlankInput
    >
  ) => {
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



app.frame(
  "/finish",
  analytics,
  async (
    c: FrameContext<
      {
        State: State;
      },
      "/",
      BlankInput
    >
  ) => {
    const { transactionId, frameData } = c;
    console.log("User transacted", frameData?.fid)

    return c.res({
      image: "https://pbs.twimg.com/media/F4M9IOlWwAEgTDf.jpg",
      intents: [
        <Button.Link
          href={`https://arbiscan.io/tx/${transactionId}`}
        >
          View Transaction
        </Button.Link>,
        <Button.Reset>Home</Button.Reset>,
      ],
    });
  }
);

function PreviewImage({ amountReceived, token, amountInEth, ethInUsd }: { ethInUsd: number, amountInEth: string, amountReceived: string, token: TokenDetails }) {

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
        <span tw="text-gray-400 flex gap-2">{`${amountInEth} ETH ($${ethInUsd.toFixed(2)})`}</span>
        <span tw="text-4xl flex" style={{gap:"5px"}}>
          <span>{Number(amountReceived).toFixed(2)} </span><span>{token.tokenSymbol}</span>
        </span>
      </div>

      <div tw="flex justify-between py-2 items-center">
        <span tw="text-gray-400">Chain</span>
        <span style={{ gap: "4px" }} tw="flex items-center">
          <img src="https://i.ibb.co/BrQLkcw/arbitrum-arb-logo.png" width={50} height={50} />
          <span>Arbitrum</span>
        </span>
      </div>
    </div>
  );
}


app.frame("/convert", async (c) => {
  const { inputText } = c;
  let inputTextAsNumber = Number(inputText);
  let token: string;
  let usd: string;
  if (isNaN(inputTextAsNumber) || inputTextAsNumber == 0) {
    token = "0";
    usd = "0";
  } else {
    let tokenPriceData = await getTokenPrice(inputText!);
    const amount = inputTextAsNumber * tokenPriceData!.usdPrice;
    token = formatCurrency(inputTextAsNumber);
    usd = formatCurrency(amount, 11, 4);
  }

  return c.res({
    // image: <ConvertImage token={token} usd={usd} />,
    image: <PreviewImage token={token} amountInUsd={usd}  amountInEth={"0.001"}/>,
    intents: [
      <TextInput placeholder="token amount e.g 10000" />,
      <Button>Convert</Button>,
      <Button.Reset>Home</Button.Reset>,
    ],
  });
});


function ErrorImage(){
  return (
    <div
  style={{
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    fontSize: 32,
    fontWeight: 600,
  }}
>
  <img tw="absolute inset-0" src="https://i.postimg.cc/CxytCWs7/start.png" width="100%" height="100%" />
  <p tw="absolute top-0 left-10 text-red-600 font-bold text-4xl">Token Not Found. Enter a different address.</p>
</div>
  )
}


function ConvertImage({ token, usd }: { token: TokenDetails | null; usd: string }) {

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#fff",
        fontSize: 32,
        fontWeight: 600,
      }}
      //@ts-expect-error
      tw={"p-0"}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          opacity: 0.2,
          height: "100%",
          width: "100%",
        }}
      >
        <img
          src={`${imageUrls.calculatorImage}`}
          width={"100%"}
          height={"100%"}
        />
      </div>
      <p tw="text-6xl font-bold">Converter</p>
      <div tw={"flex flex-col text-8xl"}>
        <div tw={"flex justify-between items-center  mb-6"}>
          <div tw="flex flex-col items-center w-[20%]">
            <img src={`${token.tokenLogo}`} height={150} width={150} />
            <span tw={"text-4xl"}>token</span>
          </div>
          <span>{token.tokenName}</span>
        </div>
        <div tw={"flex justify-between items-center"}>
          <div tw="flex flex-col items-center w-[20%]">
            <img src={`${imageUrls.usFlagIcon}`} height={150} width={200} />
            <span tw={"text-4xl"}>USD</span>
          </div>
          <span>{usd}</span>
        </div>
      </div>
    </div>
  );
}

function TokenCardDetails({
  token,
}: {
  token: TokenDetails | null;
  }) {

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
const isEdgeFunction = typeof EdgeFunction !== 'undefined'
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)
