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
import { CommonSolUtilsConfigSetup } from "moralis/common-sol-utils";

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }
const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

const DEFAULT_TOKEN_CA = "0x912ce59144191c1204e64559fe8253a0e49e6548";
const ETHEREUM_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

type State = {
  order: any;
};

export const app = new Frog<{ State: State }>({
  assetsPath: "/",
  basePath: "/api",
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



async function handleTokenDetails(
  c: StartFrameContext,
  ca: string,
  method: string
) {
  let token1: TokenDetails | null = null
    let token2: TokenDetails | null = null


  if (method === "from") {
    [token1, token2] = await Promise.all([getTokenPrice(), getTokenPrice(ca)])
    // if (!token1 || !token2) throw new Error("Could not get token1 or token2 from moralis")
    if (!token1 || !token2)
      return invalidOrMissingCaError(c, method, "Invalid Contract Address");
    token1.tokenSymbol = 'ETH'
  }

  else {
    [token1, token2] = await Promise.all([getTokenPrice(ca), getTokenPrice()])
    // if(!token1 || !token2) throw new Error("Could not get token1 or token2 from moralis")
    if (!token1 || !token2)
      return invalidOrMissingCaError(c, method, "Invalid Contract Address");
    token2.tokenSymbol = 'ETH'
  }


  const heading = getHeading(method);



  return c.res({
    image: <MainSwapImage heading={heading} token1={token1} token2={token2}
      error={true}

    />,
    // image: dummyImage,
    intents: [
      <TextInput placeholder={`Amount (in ${token1.tokenSymbol})`} />,
      <Button value={method} action={`/confirm/${ca}`}>
        Proceed
      </Button>,
      <Button value={method} action="/methods">Back</Button>,
    ],
  });
}
async function invalidOrMissingCaError(
  c: StartFrameContext,
  method: string,
  error: string,
) {
  const ethDetails = {
    tokenLogo: "https://i.ibb.co/Mg8Yd81/eth.png",
    tokenSymbol: 'ETH'
  }

  console.log({method})
  console.log({ error })
  const heading = getHeading(method);


  if (method === "from") {
    return c.res({
      image: (
        //@ts-expect-error
        <MainSwapImage token1={ethDetails} heading={heading} message={error} error={true} />
      ),
      intents: [
        <TextInput placeholder="Enter Token Address e.g: 0x.." />,
        <Button action="/token" value="from">
          Proceed
        </Button>,
        <Button value="from" action="/methods">Back</Button>,
      ],
    });

  }

  else {
    return c.res({
      image: (
        //@ts-expect-error
        <MainSwapImage token2={ethDetails} heading={heading} message={error} error={true} />
      ),
      intents: [
        <TextInput placeholder="Enter Contract Address e.g: 0x.." />,
        <Button value="to" action="/token">
          Proceed
        </Button>,
        <Button value="to" action="/methods">Back</Button>,
      ],
    });
  }
}



// const dummyImage = "https://i.postimg.cc/Kv3j32RY/start.png";
const dummyImage = "https://i.ibb.co/VYCmKgj/dummy-Image.jpg";

app.frame("/", analytics, async (c: StartFrameContext) => {
  return c.res({
    action: "/methods",
    // image: "https://i.postimg.cc/Kv3j32RY/start.png",
    image: "https://i.postimg.cc/CxytCWs7/start.png",
    intents: [
      <Button value={"from"}>ETH-TOKEN</Button>,
      <Button value={"to"}>TOKEN-ETH</Button>,
      <Button action="/swap/token1/token2/amount">TOKEN-TOKEN</Button>,
    ],
  });
});

app.frame("/swap/:token1/:token2/:amount", async (c) => {

  const { inputText, url } = c;
  let token1PriceData: TokenDetails | null = null
  let token2PriceData: TokenDetails | null = null
  let res: Response | null = null
  let error: string | undefined = undefined

  let { token1, token2, amount } = c.req.param()
  console.log({token1, token2, amount})

  if (token1 === "token1") token1 = inputText ?? "token1";
  else if (token2 === "token2") token2 = inputText ?? "token2";
  else amount = inputText ?? "amount";

  console.log({ token1, token2, amount })
  if (token1 === ETHEREUM_ADDRESS) {
    token1 = 'token1'
    error = 'Invalid contract address'
  }
  if (token2 === token1) {
    token2 = 'token2'
    error = 'Both addresses must be different'
  }
  if (token2 === ETHEREUM_ADDRESS) {
    token2 = 'token2'
    error = "Invalid contract address"
  }
  if (token1 === "token1") {
    console.log("Token 1 not defined");
    return c.res({
      image: <MainSwapImage />,
      intents: [
        <TextInput placeholder="Token 1 CA" />,
        <Button action="/swap/token1/token2/ amount">Next</Button>,
        <Button.Reset>Back</Button.Reset>
      ],
    });
  } else if (token2 === "token2") {
    token1PriceData = await getTokenPrice(token1);
    if (!token1PriceData) throw new Error
      ("Token 1 price data missing");
    console.log("Token 2 not defined");
    return c.res({
      image: <MainSwapImage token1={token1PriceData} message={error}
      error={!!error}
      />,
      intents: [
        <TextInput placeholder="Token 2 CA" />,
        <Button action={`/swap/${token1}/token2/amount`}>Next</Button>,
        <Button action="/swap/token1/token2/amount">Back</Button>,
      ],
    });
  } else if (amount === "amount") {
    [token1PriceData, token2PriceData] = await Promise.all([
      getTokenPrice(token1),
      getTokenPrice(token2),
    ]);
    if (!token1PriceData || !token2PriceData)
      throw new Error("Token 1 or Token 2 Missing");
    console.log("Amount not defined");
    return c.res({
      image: (
        <MainSwapImage token1={token1PriceData} token2={token2PriceData} />
      ),
      intents: [
        <TextInput placeholder={`Amount in ${token1PriceData.tokenSymbol}`} />,
        <Button action={`/swap/${token1}/${token2}/amount`}>Next</Button>,
        <Button action={`/swap/${token1}/token2/amount`}>Back</Button>,
      ],
    });
  }

  if (token1 === "token1" || token2 === "token2" || amount === "amount") throw new Error("Not allowed")
    let amountAsNumber = Number(amount);
    if (
      isNaN(amountAsNumber) ||
      amountAsNumber == 0
    ) {
      amount = "1";
      amountAsNumber = Number(amount);
    }



  const action = `/approved/${token1}/${token2}/${amountAsNumber}`;

  const baseUrl = `https://arbitrum.api.0x.org/swap/v1/price?`;
  const params = new URLSearchParams({
    sellToken: token1,
    buyToken: token2,
    sellAmount: parseEther(`${amountAsNumber}`).toString(),
  }).toString();

  const fetcher = fetch(baseUrl + params, {
    headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" },
  });

  [token1PriceData, token2PriceData, res] = await Promise.all([
    getTokenPrice(token1),
    getTokenPrice(token2),
    fetcher
  ]);
  if (!token1PriceData || !token2PriceData) throw new Error("Could not fetch data")

  if (!res || !res.ok) {
    error = "Swap pool not found"
    return c.res({
      image: (
        <MainSwapImage token1={token1PriceData} token2={token2PriceData} message={error} error={!!error} />
      ),
      intents: [
        <TextInput placeholder={`Amount in ${token1PriceData.tokenSymbol}`} />,
        <Button action={`/swap/${token1}/${token2}/amount`}>Next</Button>,
        <Button action={`/swap/${token1}/${token2}/amount`}>Back</Button>,
      ],
    });

  }
  const priceData = (await res.json()) as ZeroxSwapPriceData;
  const tokenAmountReceived = Number(priceData.price) * amountAsNumber;


  return c.res({
    action,
    image: <MainSwapImage
      heading={`Approve Spending ${token1PriceData.tokenSymbol}`}
      token1={token1PriceData} token2={token2PriceData} sendAmount={amountAsNumber} receiveAmount={tokenAmountReceived} />,
    intents: [
      <Button.Transaction target={`/approve/${token1}`}>
        Approve
      </Button.Transaction>,
      <Button action={`/swap/${token1}/${token2}/amount`}>Back</Button>,
    ],
  });
});

app.frame("/methods", async (c) => {
  const { buttonValue } = c;
  //No arguments = eth price
  let token = await getTokenPrice();
  console.log(token?.tokenLogo)
    if (!token) throw new Error("Token not found");
   token.tokenSymbol = "ETH"

  if (buttonValue == "from") {
    return c.res({
      image: <MainSwapImage
        heading="Preview Purchase"
        token1={token}
        message="Leave blank for $ARB"
        error={false}
      />,
      intents: [
        <TextInput placeholder="Enter Contract Address e.g: 0x.." />,
        <Button value="from" action="/token">
          Proceed
        </Button>,
        <Button.Reset>Home</Button.Reset>,
      ],
    });
  }

  return c.res({
    image: <MainSwapImage
    heading={"Preview Sell"}
      token2={token}
      message="Leave blank for $ARB"
      error={false}
    />,
    intents: [
      <TextInput placeholder="Enter Token Address e.g: 0x.." />,
      <Button action="/token" value="to">
        Proceed
      </Button>,
      <Button.Reset>Home</Button.Reset>,
    ],
  });
});

function getHeading(method: string) {
  return method === "from" ? "Preview Purchase" : "Preview Sell"
}

app.frame("/token", analytics, async (c: StartFrameContext) => {
  const { inputText, buttonValue } = c;
  let ca = inputText;
  let method = buttonValue;


  if (!method) method = "from";
  // if (!ca) ca = DEFAULT_TOKEN_CA;
  console.log({ ca })
    if (!ca) ca = DEFAULT_TOKEN_CA;

  return handleTokenDetails(c, ca, method);
});
app.frame("/exact_token/:ca", analytics, async (c: StartFrameContext) => {
  let method = "from";
  let ca = c.req.param("ca");
  if (!ca) ca = DEFAULT_TOKEN_CA;
  return handleTokenDetails(c, ca, method);
});

app.frame("/confirm/:ca", analytics, async (c: StartFrameContext) => {
  const { buttonValue } = c;
  let method = buttonValue;
  if (!method) method = "from";
  const ca = c.req.param("ca");
  if (!ca) throw new Error("Contract address missing");
  let { inputText: tokenAmount } = c;
  let tokenAmountAsNumber = Number(tokenAmount);
  if (isNaN(tokenAmountAsNumber) || tokenAmountAsNumber == 0 || !tokenAmount) {
    tokenAmount = "0.01";
    tokenAmountAsNumber = Number(tokenAmount);
  }

  const baseUrl = `https://arbitrum.api.0x.org/swap/v1/price?`;
  const eth = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  let token1 = method === "from" ? eth : ca;
  let token2 = method === "from" ? ca : eth;

  let token1PriceData: TokenDetails | null = null;
  let token2PriceData: TokenDetails | null = null;
  let res: Response | null = null;



  const params = new URLSearchParams({
    sellToken: token1,
    buyToken: token2,
    sellAmount: parseEther(tokenAmount).toString(),
  }).toString();




  // fs.writeFileSync("price.json", JSON.stringify(priceData, null, 2));
  const fetcher = fetch(baseUrl + params, {
    headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" },
  });


  if (method === "from") {
    [token1PriceData, token2PriceData, res] = await Promise.all([
      getTokenPrice(),
      getTokenPrice(ca),
      fetcher
    ]);
    if (!token1PriceData || !token2PriceData)
      throw new Error("Could not get token1 or token2 from moralis");
    token1PriceData.tokenSymbol = "ETH";
  } else {
    [token1PriceData, token2PriceData, res] = await Promise.all([
      getTokenPrice(ca),
      getTokenPrice(),
      fetcher
    ]);
    if (!token1PriceData || !token2PriceData)
      throw new Error("Could not get token1 or token2 from moralis");


    token2PriceData.tokenSymbol = "ETH";
  }

  const priceData = (await res.json()) as ZeroxSwapPriceData;
  const tokenAmountReceived = Number(priceData.price) * tokenAmountAsNumber;



  const action =
    method === "from"
      ? "/finish"
      : `/approved/${token1}/${token2}/${tokenAmount}`;
  console.log({ action });
  const transactionTarget =
    method === "from" ? `/tx/${method}/${ca}/${tokenAmount}` : `/approve/${ca}`;
  return c.res({
    action,

    image: (
      <MainSwapImage
        sendAmount={tokenAmountAsNumber}
        receiveAmount={tokenAmountReceived}
        token1={token1PriceData}
        token2={token2PriceData}
      />
    ),

    intents: [
      <Button.Transaction target={transactionTarget}>
        {method == "from" ? "Confirm" : "Approve"}
      </Button.Transaction>,
      method == "from" ? <Button action={`/exact_token/${ca}`}>Back</Button> : <Button value="to" action="/methods">Cancel</Button>
    ],
  });
});

app.frame("/approved/:token1/:token2/:amount", async (c) => {
  console.log("I am in approved");
  const token1 = c.req.param("token1");
  const token2 = c.req.param("token2") ?? ETHEREUM_ADDRESS;
  let amount = c.req.param("amount");

  console.log({ token1, token2, amount });
  if (!token1 || !amount) throw new Error("Token 1 not defined");
    let amountAsNumber = Number(amount);
    if (isNaN(amountAsNumber) || amountAsNumber == 0) {
      amount = "1";
      amountAsNumber = Number(amount);
    }



  const transactionTarget = `/sell/${token1}/${token2}/${amount}`;
  console.log({ transactionTarget });
  let token1PriceData: TokenDetails | null = null;
  let token2PriceData: TokenDetails | null = null;
  let res: Response | null = null;

  const baseUrl = `https://arbitrum.api.0x.org/swap/v1/price?`;
  const params = new URLSearchParams({
    sellToken: token1,
    buyToken: token2,
    sellAmount: parseEther(amount).toString(),
  }).toString();

  const fetcher = fetch(baseUrl + params, {
    headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" },
  });

  if (token2 === ETHEREUM_ADDRESS) {
    [token1PriceData, token2PriceData, res] = await Promise.all([
      getTokenPrice(token1),
      getTokenPrice(),
      fetcher,
    ]);
    if (!token1PriceData || !token2PriceData)
      throw new Error("Could not get token1 or token2 from moralis");
    token2PriceData.tokenSymbol = "ETH";
  } else {
    [token1PriceData, token2PriceData, res] = await Promise.all([
      getTokenPrice(token1),
      getTokenPrice(token2),
      fetcher,
    ]);
    if (!token1PriceData || !token2PriceData)
      throw new Error("Could not get token1 or token2 from moralis");
  }

  const priceData = (await res.json()) as ZeroxSwapPriceData;
  const tokenAmountReceived = Number(priceData.price) * Number(amount);

  return c.res({
    action: "/finish",
    image: (
      <MainSwapImage
        heading={"Confirm Swap"}
        token1={token1PriceData}
        token2={token2PriceData}
        sendAmount={amountAsNumber}
        receiveAmount={tokenAmountReceived}
      />
    ),
    intents: [
      <Button.Transaction target={transactionTarget}>
        Confirm
      </Button.Transaction>,
      <Button value={"to"} action="/methods">
        Cancel
      </Button>,
    ],
  });
});

app.frame("/finish", analytics, async (c: StartFrameContext) => {
  const { transactionId, frameData } = c;
  console.log("User transacted", frameData?.fid);
  const transactionHash = `https://arbiscan.io/tx/${transactionId}`;
  console.log({ transactionHash });

  return c.res({
    image: "https://pbs.twimg.com/media/F4M9IOlWwAEgTDf.jpg",
    intents: [
      <Button.Link href={transactionHash}>View Transaction</Button.Link>,
      <Button.Reset>Home</Button.Reset>,
    ],
  });
});



app.transaction("/approve/:ca", async (c) => {
  const ca = c.req.param("ca");
  const maxApproval = BigInt(2) ** BigInt(256) - BigInt(1);

  return c.contract({
    chainId: "eip155:42161",
    abi: ERC20TokenAbi,
    functionName: "approve",
    args: [`0xdef1c0ded9bec7f1a1670819833240f027b25eff`, maxApproval],
    to: ca as `0x${string}`,
  });
});

app.transaction("/sell/:token1/:token2/:amount", async (c) => {
  console.log("I am in sell");
  const token1 = c.req.param("token1");
  const token2 = c.req.param("token2");
  const amount = c.req.param("amount");
  console.log({ token1, token2, amount });
  if (!token1 || !token2 || !amount) throw new Error("Values missing");

  const params = new URLSearchParams({
    sellToken: token1,
    buyToken: token2,
    sellAmount: parseEther(amount).toString(),
    feeRecipient: "0x8ff47879d9eE072b593604b8b3009577Ff7d6809",
    buyTokenPercentageFee: "0.01",
  }).toString();
  const baseUrl = `https://arbitrum.api.0x.org/swap/v1/quote?`;

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
});

type StartTransactionContext = TransactionContext<
  {
    State: State;
  },
  "/tx/:ca/:amount",
  BlankInput
>;

app.transaction(
  "/tx/:method/:ca/:amount",
  analytics,
  async (c: StartTransactionContext) => {
    const method = c.req.param("method");
    const ca = c.req.param("ca");
    const amount = c.req.param("amount");

    if (!ca || !amount || !method)
      throw new Error("Missing Contract address or Amount");
    // prettier-ignore

    const baseUrl = `https://arbitrum.api.0x.org/swap/v1/quote?`

    const eth = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    let token1 = method === "from" ? ca : eth;
    let token2 = method === "from" ? eth : ca;

    console.log({ token1, token2 });
    const params = new URLSearchParams({
      buyToken: token1,
      sellToken: token2,
      sellAmount: parseEther(amount).toString(),
      feeRecipient: "0x8ff47879d9eE072b593604b8b3009577Ff7d6809",
      buyTokenPercentageFee: "0.01",
    }).toString();

    const res = await fetch(baseUrl + params, {
      headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" },
    });

    const order = (await res.json()) as ZeroxSwapQuoteOrder;
    // fs.writeFileSync("order.json", JSON.stringify(order, null , 2))

    return c.send({
      chainId: `eip155:42161`,
      to: order.to,
      data: order.data,
      value: BigInt(order.value),
    });
  }
);

function SwapImage({ text }: { text: string }) {
  if (!text) text = "Hello World";
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
      <svg
        width="75"
        viewBox="0 0 75 65"
        fill="#000"
        style={{ margin: "0 75px" }}
      >
        <path d="M37.59.25l36.95 64H.64l36.95-64z"></path>
      </svg>
      <div tw="flex" style={{ marginTop: 40 }}>
        {text}
      </div>
    </div>
  );
}

function MainSwapImage({
  token1,
  token2,
  sendAmount,
  receiveAmount,
  message,
  heading,
  error
}: {
  token1?: TokenDetails,
  token2?: TokenDetails,
  sendAmount?: number,
  receiveAmount?: number,
  message?: string
  heading?: string
  active?: string
  error?: boolean
}) {
  // const dummyImage = "https://i.imgur.com/mt3nbeI.jpg";
  if (!heading) heading = 'Preview Swap'


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
        <span tw="text-6xl my-4">{heading}</span>
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
                src={token1 ? token1.tokenLogo : dummyImage}
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
                src={token2 ? token2.tokenLogo : dummyImage}
                width={"100%"}
                height={"100%"}
                style={{
                  objectFit: "cover",
                }}
              />
            </div>
          </div>

          <div tw="flex w-full justify-between px-4">
            <span>{token1 ? token1.tokenSymbol : "??"}</span>
            <span>{token2 ? token2.tokenSymbol : "??"}</span>
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
          <span tw="text-gray-400 flex gap-2">{`${sendAmount ? sendAmount.toFixed(2) :  "??"} ${
            token1 ? token1.tokenSymbol : "??"
          }`}</span>
          <span tw="text-4xl flex" style={{ gap: "10px" }}>
            <span>{receiveAmount ?receiveAmount.toFixed(2) : "??"} </span>
            <span>{token2 ? token2.tokenSymbol : "??"}</span>
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
        {message ? <div tw="absolute bottom-10 w-full flex justify-center rounded-full mx-auto">
          <span tw={`w-3/5 flex justify-center rounded-xl py-2 ${error ? "bg-red-400" : "bg-green-600"}`}>
            {message}
          </span>
        </div>
        : <div tw="hidden"></div>}
      </div>
    );
  }
function PreviewImage({
  method,
  amountReceived,
  token,
  amountInEth,
  ethInUsd,
}: {
  method: string;
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

const ERC20TokenAbi = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "success", type: "bool" }],
    type: "function",
  },
  // Add other ABI items you need
];

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
