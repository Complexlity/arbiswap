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
import { BlankInput } from "hono/types";
import { createPublicClient, http, parseEther } from "viem";
import { arbitrum } from "viem/chains";
import {
  ethereumToUrlSafeBase64,
  urlSafeBase64ToEthereum,
} from "../utils/lib.js";
import { fdk } from "../utils/pinata.js";
import { kvStore, nanoid } from "../utils/services.js";
import { TokenDetails, getTokenPrice } from "../utils/token.js";
import { ZeroxSwapPriceData, ZeroxSwapQuoteOrder } from "../utils/types.js";
import { MiddlewareHandler } from "frog";
import { japanese } from "viem/accounts";
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
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USDT_ADDRESS = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
const BLOO_ADDRESS="0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3"

const shortcuts = {
  usdc: USDC_ADDRESS,
  usdt: USDT_ADDRESS,
  arb: DEFAULT_TOKEN_CA,
  bloo: BLOO_ADDRESS
}
const ethDetails = {
  tokenLogo: "https://i.ibb.co/Mg8Yd81/eth.png",
  tokenSymbol: "ETH",
};

type State = {
  token1: {
    ca: string;
    logo: string;
    sym: string;
    dec: string;
    usd?: number;
  } | null;
  token2: {
    ca: string;
    logo: string;
    sym: string;
    dec: string;
    usd?: number;
  } | null;
  sendAmount: number | null;
  receiveAmount: number | null;
};

function getTokenAddress(_input?: string) {
  if(!_input) return _input
  let input = _input.toLowerCase().trim()
  if (shortcuts.hasOwnProperty(input.toLowerCase())) {
    //@ts-expect-error
    return shortcuts[input]
  }
  else return input
}

export const app = new Frog<{ State: State }>({
  assetsPath: "/",
  basePath: "/api",
  initialState: {
    token1: {
      ca: "",
      logo: "",
      sym: "",
    },
    token2: {
      ca: "",
      logo: "",
      sym: "",
    },
    sendAmount: 0,
    receiveAmount: 0,
    },
  browserLocation: "https://app.uniswap.org/swap?chain=arbitrum"
});

const analytics = fdk.analyticsMiddleware({
  frameId: "buy-tokens-on-arbitrum",
});

// const analytics = (c: AnyFrameContext): AnyFrameContext => c;
type StartFrameContext = FrameContext<
  {
    State: State;
  },
  "/",
  BlankInput
>;
type AnyFrameContext = FrameContext<
  {
    State: State;
  },
  string,
  BlankInput
>;

async function handleTokenDetails(
  c: StartFrameContext,
  ca: string,
  method: string
) {
  const { previousState, deriveState } = c;
  let newState = previousState;
  let token1: TokenDetails | null = null;
  let token2: TokenDetails | null = null;
  console.log({ method });
  if (method === "from") {
    [token1, token2] = await Promise.all([getTokenPrice(), getTokenPrice(ca)]);
    // if (!token1 || !token2) throw new Error("Could not get token1 or token2 from moralis")

    if (!token1 || !token2) {
      return invalidOrMissingCaError(c, method, "Unsupported Contract Address. Try just 'usdc' ");
    }

    token1.tokenSymbol = "ETH";

    newState = deriveState((previousState) => {
      previousState.token1 = {
        ca: ETHEREUM_ADDRESS,
        sym: "ETH",
        logo: ethDetails.tokenLogo,
        dec: "18",
        usd: token1?.usdPrice,
      };
      previousState.token2 = {
        ca,
        //@ts-expect-error
        sym: token2.tokenSymbol,

        //@ts-expect-error
        logo: token2.tokenLogo,

        //@ts-expect-error
        dec: token2.tokenDecimals,

        //@ts-expect-error
        usd: token2.usdPrice,
      };
    });
  } else {
    [token1, token2] = await Promise.all([getTokenPrice(ca), getTokenPrice()]);
    // if(!token1 || !token2) throw new Error("Could not get token1 or token2 from moralis")
    if (!token1 || !token2)
      return invalidOrMissingCaError(c, method, "Unsupported Contract Address. Try just 'usdc' ");
    token2.tokenSymbol = "ETH";
    console.log("I am here");
    newState = deriveState((previousState) => {
      previousState.token1 = {
        ca,

        //@ts-expect-error
        sym: token1.tokenSymbol,

        //@ts-expect-error
        logo: token1.tokenLogo,

        //@ts-expect-error
        dec: token1.tokenDecimals,

        //@ts-expect-error
        usd: token1.usdPrice,
      };
      previousState.token2 = {
        ca: ETHEREUM_ADDRESS,
        sym: "ETH",
        logo: ethDetails.tokenLogo,
        dec: "18",
        usd: token2?.usdPrice,
      };
    });
  }

  // console.log({newState})

  return c.res({
    image: <S t1={token1} t2={token2} />,
    // image: dummyImage,
    intents: [
      <TextInput placeholder={`Amount (in ${token1.tokenSymbol})`} />,
      <Button value={method} action={`/confirm/${ca}`}>
        Next ➡️
      </Button>,
      <Button value={method} action="/methods">
        ⬅️ Back
      </Button>,
    ],
  });
}
async function invalidOrMissingCaError(
  c: StartFrameContext,
  method: string,
  error: string
) {
  console.log({ method });
  console.log({ error });
  const heading = getHeading(method);

  if (method === "from") {
    return c.res({
      image: <S t1={ethDetails} m={error} e={true} />,
      intents: [
        <TextInput placeholder="CA. Leave blank for $ARB" />,
        <Button action="/token" value="from">
          Next ➡️
        </Button>,
        <Button value="from" action="/methods">
          ⬅️ Back
        </Button>,
      ],
    });
  } else {
    return c.res({
      image: <S m={error} e={true} t2={ethDetails} />,
      intents: [
        <TextInput placeholder="CA. Leave blank for $ARB" />,
        <Button value="to" action="/token">
          Next ➡️
        </Button>,
        <Button value="to" action="/methods">
          ⬅️ Back
        </Button>,
      ],
    });
  }
}

// const dummyImage = "https://i.postimg.cc/Kv3j32RY/start.png";
const dummyImage = "https://i.ibb.co/VYCmKgj/dummy-Image.jpg";
// image: "https://i.postimg.cc/Kv3j32RY/start.png",

app.frame("/",  async (c: StartFrameContext) => {
  return c.res({
    title: "Arbiswap, Swap all tokens on arbitrum",
    action: "/methods",
    image: "https://i.ibb.co/vCNS827/start2.png",
    intents: [
      <Button value={"from"}>BUY ↙️</Button>,
      <Button value={"to"}>SELL ↗️</Button>,
      <Button action="/swap/start">SWAP 🔁</Button>,
    ],
    browserLocation: "https://app.uniswap.org/swap?chain=arbitrum",
  });
});

app.frame("/swap/start",  async (c) => {
  return c.res({
    image: <S m={"Shortcuts: usdc, usdt, arb, bloo"} />,
    intents: [
      <TextInput placeholder="Contract Address or Shortcut" />,
      <Button action="/swap/token1">Next ➡️</Button>,
      <Button.Reset>⬅️ Back</Button.Reset>,
    ],
  });
});
app.frame("/swap/token1",  async (c) => {
  const { inputText, deriveState, buttonValue, previousState } = c;
  let state = previousState;
  if (buttonValue !== "back") {
    const token1 = getTokenAddress(inputText);
    if (!token1) {
      return c.res({
        image: <S m="Invalid Token Address. Try just 'usdc' " e={true} />,
        intents: [
          <TextInput placeholder="Token 1 CA" />,
          <Button action="/swap/token1">Next ➡️</Button>,
          <Button.Reset>⬅️ Back</Button.Reset>,
        ],
      });
    }

    const token1PriceData = await getTokenPrice(token1);
    if (!token1PriceData) {
      return c.res({
        image: <S m="Unsupported Token Address. Try just 'usdc' " e={true} />,
        intents: [
          <TextInput placeholder="Token 1 CA" />,
          <Button action="/swap/token1">Next ➡️</Button>,
          <Button.Reset>⬅️ Back</Button.Reset>,
        ],
      });
    }
    state = deriveState((previousState) => {
      previousState.token1 = {
        ca: token1PriceData.tokenAddress,
        logo: token1PriceData.tokenLogo,
        sym: token1PriceData.tokenSymbol,
        dec: token1PriceData.tokenDecimals,
        usd: token1PriceData.usdPrice,
      };
    });
  } else {
    state = deriveState((previousState) => {
      previousState.token2 = null;
    });
  }

  return c.res({
    image: (
      <S
        m={"Shortcuts: usdc, usdt, arb, bloo"}
        t1={{ tokenLogo: state.token1!.logo, tokenSymbol: state.token1!.sym }}
      />
    ),
    intents: [
      <TextInput placeholder="Contract Address or Shortcut" />,
      <Button action="/swap/token2">Next ➡️</Button>,
      <Button action="/swap/start">⬅️ Back</Button>,
    ],
  });
});

app.frame("/swap/token2",  async (c) => {
  const { inputText, previousState, deriveState, buttonValue } = c;
  let state = previousState;
  let token1 = previousState.token1;
  let token2 = previousState.token2;
  if (!token1) {
    return c.res({
      image: <S m="Invalid Token Address. Try 'usdc' " e={true} />,
      intents: [
        <TextInput placeholder="Contract Address or Shortcuts" />,
        <Button action="/swap/token1">Next ➡️</Button>,
        <Button.Reset>⬅️ Back</Button.Reset>,
      ],
    });
  }
  if (buttonValue !== "back") {
    let token2 = getTokenAddress(inputText);
    if (!token2) {
      return c.res({
        image: (
          <S
            m={"Invalid Token Address. Try just 'usdc' "}
            t1={{
              tokenLogo: token1.logo,
              tokenSymbol: token1.sym,
            }}
          />
        ),
        intents: [
          <TextInput placeholder="Contract Address or Shortcuts" />,
          <Button action="/swap/token2">Next ➡️</Button>,
          <Button action="/swap/start">⬅️ Back</Button>,
        ],
      });
    }
    const token2PriceData = await getTokenPrice(token2);
    if (!token2PriceData) {
      return c.res({
        image: (
          <S
            m="Unsupported Token Address. Try just 'usdc' "
            e={true}
            t1={{ tokenLogo: token1.logo, tokenSymbol: token1.sym }}
          />
        ),
        intents: [
          <TextInput placeholder="Contract Address or Shortcuts" />,
          <Button action="/swap/token2">Next ➡️</Button>,
          <Button action="/swap/start">⬅️ Back</Button>,
        ],
      });
    }
    state = deriveState((previousState) => {
      previousState.token2 = {
        ca: token2,
        logo: token2PriceData.tokenLogo,
        sym: token2PriceData.tokenSymbol,
        dec: token2PriceData.tokenDecimals,
        usd: token2PriceData.usdPrice,
      };
    });
  } else {
    state = deriveState((previousState) => {
      previousState.sendAmount = null;
    });
  }

  token2 = state.token2;
  if (!token2) {
    return c.res({
      image: (
        <S
          m="Invalid Token Address. Try just 'usdc' "
          e={true}
          t1={{ tokenLogo: token1.logo, tokenSymbol: token1.sym }}
        />
      ),
      intents: [
        <TextInput placeholder="Contract Address or Shortcuts" />,
        <Button action="/swap/token2">Next ➡️</Button>,
        <Button action="/swap/start">⬅️ Back</Button>,
      ],
    });
  }

  let token1Details = {
    tokenLogo: token1.logo,
    tokenSymbol: token1.sym,
  };
  let token2Details = {
    tokenLogo: token2.logo,
    tokenSymbol: token2.sym,
  };

  return c.res({
    image: <S t1={token1Details} t2={token2Details} />,
    intents: [
      <TextInput placeholder={`Amount in ${token1.sym}`} />,
      <Button action="/swap/amount">Next ➡️</Button>,
      <Button action="/swap/token1" value="back">
        ⬅️ Back
      </Button>,
    ],
  });
});

app.frame("/swap/amount",  async (c) => {
  const { inputText, deriveState, previousState, buttonValue } = c;
  let amount = Number(inputText);
  if (!amount) amount = 0.01;
  let state = previousState;
  const { token1, token2 } = previousState;
  if (!token1) {
    return c.res({
      image: <S m="Invalid Token Address" e={true} />,
      intents: [
        <TextInput placeholder="Token 1 CA" />,
        <Button action="/swap/token1">Next ➡️</Button>,
        <Button.Reset>⬅️ Back</Button.Reset>,
      ],
    });
  }

  if (!token2) {
    return c.res({
      image: (
        <S
          m="Invalid Token Address"
          e={true}
          t1={{ tokenLogo: token1.logo, tokenSymbol: token1.sym }}
        />
      ),
      intents: [
        <TextInput placeholder="Token 2 CA" />,
        <Button action="/swap/token2">Next ➡️</Button>,
        <Button action="/swap/start">⬅️ Back</Button>,
      ],
    });
  }
  let tokenAmountReceived = 0;
  let sellAmount = parseEther(`${amount}`).toString();
  if (token1.dec !== "18") {
    sellAmount = `${amount * Number(`1e${token1.dec}`)}`;
  }
  console.log({ sellAmount });

  if (buttonValue !== "back") {
    const params = new URLSearchParams({
      sellToken: token1.ca,
      buyToken: token2.ca,
      sellAmount,
    }).toString();
    const baseUrl = `https://arbitrum.api.0x.org/swap/v1/price?`;
    // fs.writeFileSync("price.json", JSON.stringify(priceData, null, 2));
    const fetcher = fetch(baseUrl + params, {
      headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" },
    });
    let priceData: ZeroxSwapPriceData | null = null;
    try {
      const res = await fetcher;
      priceData = (await res.json()) as ZeroxSwapPriceData;
      tokenAmountReceived = Number(priceData.price) * amount;
    } catch (error) {
      console.log({ error });
      console.log("Price Date fetch error");
      priceData = null;
    }

    if (!priceData) {
      let token1PriceData = {
        tokenLogo: token1.logo,
        tokenSymbol: token1.sym,
      };
      let token2PriceData = {
        tokenLogo: token2.logo,
        tokenSymbol: token2.sym,
      };

      return c.res({
        image: (
          <S
            m="Swap pool not found"
            e={true}
            t1={token1PriceData}
            t2={token2PriceData}
          />
        ),
        intents: [
          <TextInput placeholder={`Amount in ${token1.sym}`} />,
          <Button action="/swap/amount">Next ➡️</Button>,
          <Button action="/swap/token1" value="back">
            ⬅️ Back
          </Button>,
        ],
      });
    }

    state = deriveState((previousState) => {
      (previousState.sendAmount = amount),
        (previousState.receiveAmount = tokenAmountReceived);
    });
  } else {
    amount = previousState.sendAmount ?? 0.01;
    tokenAmountReceived = previousState.receiveAmount ?? 0;
  }

  let token1PriceData = {
    tokenLogo: token1.logo,
    tokenSymbol: token1.sym,
  };
  let token2PriceData = {
    tokenLogo: token2.logo,
    tokenSymbol: token2.sym,
  };

  const txTarget = `/approve/${token1.ca}`;

  return c.res({
    action: "/swap/approve",
    image: (
      <S
        t1={{ ...token1PriceData, usdPrice: token1.usd }}
        t2={token2PriceData}
        sA={amount}
        rA={tokenAmountReceived}
      />
    ),
    intents: [
      <Button.Transaction target={txTarget}>
        Approve {token1.sym}
      </Button.Transaction>,
      <Button value="back" action="/swap/token2">
        ⬅️ Back
      </Button>,
    ],
  });
});

app.frame("/swap/approve",  async (c) => {
  console.log("I am in approved");

  const { previousState } = c;
  const { token1, token2, sendAmount, receiveAmount } = previousState;
  if (!token1 || !token2 || !sendAmount)
    throw new Error("Token 1 or Token 2 or Send Amount missing");

  const transactionTarget = `/sell/${token1.ca}/${token2.ca}/${sendAmount}`;
  console.log({ transactionTarget });
  let token1PriceData = {
    tokenLogo: token1.logo,
    tokenSymbol: token1.sym,
  };
  let token2PriceData = {
    tokenLogo: token2.logo,
    tokenSymbol: token2.sym,
  };

  return c.res({
    action: "/finish",
    image: (
      <S
        t1={{ ...token1PriceData, usdPrice: token1.usd }}
        t2={token2PriceData}
        sA={sendAmount}
        rA={receiveAmount!}
      />
    ),
    intents: [
      <Button.Transaction target={transactionTarget}>
        Confirm Swap
      </Button.Transaction>,
      <Button value="back" action="/swap/amount">
        ⬅️ Back
      </Button>,
    ],
  });
});

app.frame("/s/:token1/:token2/:amount",  async (c) => {
  const { inputText, buttonValue } = c;
  let token1PriceData: TokenDetails | null = null;
  let token2PriceData: TokenDetails | null = null;
  let res: Response | null = null;

  let { token1, token2, amount } = c.req.param();
  console.log("Before encoding");
  console.log({ token1, token2, amount });

  if (token1 !== "token1") token1 = urlSafeBase64ToEthereum(token1);
  if (token2 !== "token2") token2 = urlSafeBase64ToEthereum(token2);
  console.log("After encoding");
  console.log({ token1, token2 });

  if (token1 === "token1" && buttonValue !== "back")
    token1 = inputText ?? "token1";
  else if (token2 === "token2" && buttonValue !== "back")
    token2 = inputText ?? "token2";
  else amount = inputText ?? "amount";

  if (token1 === ETHEREUM_ADDRESS) {
    token1 = "token1";
  }
  if (token2 === token1) {
    token2 = "token2";
  }
  if (token2 === ETHEREUM_ADDRESS) {
    token2 = "token2";
  }

  console.log("After input checking");
  console.log({ token1, token2 });

  if (token1 === "token1") {
    console.log("Token 1 not defined");
    return c.res({
      image: <S />,
      intents: [
        <TextInput placeholder="Token 1 CA" />,
        <Button action="/s/token1/token2/amount">Next ➡️</Button>,
        <Button.Reset>⬅️ Back</Button.Reset>,
      ],
    });
  } else if (token2 === "token2") {
    token1PriceData = await getTokenPrice(token1);
    if (!token1PriceData) throw new Error("Token 1 price data missing");
    console.log("Token 2 not defined");
    token1 = ethereumToUrlSafeBase64(token1);
    console.log("Before exit");
    console.log({ token1 });
    return c.res({
      image: <S t1={token1PriceData} />,
      intents: [
        <TextInput placeholder="Token 2 CA" />,
        <Button action={`/s/${token1}/token2/amount`}>Next ➡️</Button>,
        <Button value="back" action="/s/token1/token2/amount">
          ⬅️ Back
        </Button>,
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
    token1 = ethereumToUrlSafeBase64(token1);
    token2 = ethereumToUrlSafeBase64(token2);
    return c.res({
      image: <S t1={token1PriceData} t2={token2PriceData} />,
      intents: [
        <TextInput placeholder={`Amount in ${token1PriceData.tokenSymbol}`} />,
        <Button action={`/s/${token1}/${token2}/amount`}>Next ➡️</Button>,
        <Button value="back" action={`/s/${token1}/token2/amount`}>
          ⬅️ Back
        </Button>,
      ],
    });
  }

  if (token1 === "token1" || token2 === "token2" || amount === "amount")
    throw new Error("Not allowed");
  let amountAsNumber = Number(amount);
  if (isNaN(amountAsNumber) || amountAsNumber == 0) {
    amount = "1";
    amountAsNumber = Number(amount);
  }

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
    fetcher,
  ]);
  if (!token1PriceData || !token2PriceData)
    throw new Error("Could not fetch data");
  token1 = ethereumToUrlSafeBase64(token1);
  token2 = ethereumToUrlSafeBase64(token2);
  if (!res || !res.ok) {
    return c.res({
      image: <S t1={token1PriceData} t2={token2PriceData} />,
      intents: [
        <TextInput placeholder={`Amount in ${token1PriceData.tokenSymbol}`} />,
        <Button action={`/s/${token1}/${token2}/amount`}>Next ➡️</Button>,
        <Button value="back" action={`/s/${token1}/${token2}/amount`}>
          ⬅️ Back
        </Button>,
      ],
    });
  }
  const priceData = (await res.json()) as ZeroxSwapPriceData;
  const tokenAmountReceived = Number(priceData.price) * amountAsNumber;
  const action = `/a/${token1}/${token2}/${amountAsNumber}`;
  return c.res({
    action,
    image: (
      <S
        t1={token1PriceData}
        t2={token2PriceData}
        sA={amountAsNumber}
        rA={tokenAmountReceived}
      />
    ),
    intents: [
      <Button.Transaction
        target={`/approve/${urlSafeBase64ToEthereum(token1)}`}
      >
        Approve {token1PriceData.tokenSymbol}
      </Button.Transaction>,
      <Button action={`/s/${token1}/${token2}/amount`}>⬅️ Back</Button>,
    ],
  });
});

app.frame("/a/:token1/:token2/:amount", async (c) => {
  console.log("I am in approved");
  let token1 = c.req.param("token1");
  let token2 = c.req.param("token2") ?? ETHEREUM_ADDRESS;
  let amount = c.req.param("amount");

  console.log({ token1, token2, amount });
  if (!token1 || !token2 || !amount) throw new Error("Token 1 not defined");
  if (token2 !== ETHEREUM_ADDRESS) {
    token1 = urlSafeBase64ToEthereum(token1);
    token2 = urlSafeBase64ToEthereum(token2);
  }
  let amountAsNumber = Number(amount);
  if (isNaN(amountAsNumber) || amountAsNumber == 0) {
    amount = "1";
    amountAsNumber = Number(amount);
  }

  const { token1: t1State, token2: t2State } = c.previousState;
  let sellDecimals = "18";
  if (t1State && t2State) {
    sellDecimals = t1State.dec;
  }

  let sellAmount =
    sellDecimals === "18"
      ? parseEther(amount).toString()
      : `${amountAsNumber * Number(`1e${sellDecimals}`)}`;

  let res: Response | null = null;

  const baseUrl = `https://arbitrum.api.0x.org/swap/v1/price?`;
  const params = new URLSearchParams({
    sellToken: token1,
    buyToken: token2,
    sellAmount,
  }).toString();

  const fetcher = fetch(baseUrl + params, {
    headers: { "0x-api-key": process.env.ZEROX_API_KEY },
  });
  let hasEth = false;
  if (token2 === ETHEREUM_ADDRESS) {
    if (!t1State || !t2State) {
      return c.res({
        image: <S m={"Leave blank for $ARB"} t2={ethDetails} />,
        intents: [
          <TextInput placeholder="Enter Token Address e.g: 0x.." />,
          <Button action="/token" value="to">
            Next ➡️
          </Button>,
          <Button.Reset>Home 🏠</Button.Reset>,
        ],
      });
    }
    try {
      res = await fetcher;
      if (!res.ok) throw new Error("Something went wrong fetching order");
    } catch (error) {
      console.log({ error });
      return c.res({
        image: (
          <S
            m={"Leave blank for $ARB"}
            t2={ethDetails}
            t1={{ tokenLogo: t1State.logo, tokenSymbol: t1State.sym }}
          />
        ),
        intents: [
          <TextInput placeholder="Enter Token Address e.g: 0x.." />,
          <Button action="/token" value="to">
            Next ➡️
          </Button>,
          <Button.Reset>Home 🏠</Button.Reset>,
        ],
      });
    }

    hasEth = true;
  } else {
    if (!t1State || !t2State) {
      return c.res({
        image: <S />,
        intents: [
          <TextInput placeholder="Token 1 CA" />,
          <Button action="/swap/token1">Next ➡️</Button>,
          <Button.Reset>⬅️ Back</Button.Reset>,
        ],
      });
    }
    try {
      res = await fetcher;
      if (!res.ok) throw new Error("Something went wrong fetching order");
    } catch (error) {
      console.log({ error });
      return c.res({
        image: <S />,
        intents: [
          <TextInput placeholder="Token 1 CA" />,
          <Button action="/swap/token1">Next ➡️</Button>,
          <Button.Reset>⬅️ Back</Button.Reset>,
        ],
      });
    }
  }

  let priceData: ZeroxSwapPriceData | null = null;
  priceData = (await res.json()) as ZeroxSwapPriceData;

  const tokenAmountReceived = Number(priceData.price) * Number(amount);

  const transactionTarget = `/sell/${token1}/${token2}/${amount}`;
  console.log({ transactionTarget });

  let token1PriceData = {
    tokenLogo: t1State.logo,
    tokenSymbol: t1State.sym,
  };
  let token2PriceData = {
    tokenLogo: t2State.logo,
    tokenSymbol: t2State.sym,
  };

  return c.res({
    action: `/finish/${token1PriceData.tokenSymbol}/${token2PriceData.tokenSymbol}/${amount}/${tokenAmountReceived}`,
    image: (
      <S
        t1={{ ...token1PriceData, usdPrice: t1State.usd }}
        t2={token2PriceData}
        sA={amountAsNumber}
        rA={tokenAmountReceived}
      />
    ),
    intents: [
      <Button.Transaction target={transactionTarget}>
        Confirm Swap
      </Button.Transaction>,
      hasEth ? (
        <Button value={`to-${token2}`} action={`/exact_token/${token2}`}>
          ⬅️ Back
        </Button>
      ) : (
        <Button
          action={`/s/${ethereumToUrlSafeBase64(
            token1
          )}/${ethereumToUrlSafeBase64(token2)}/amount`}
        >
          Cancel ❌
        </Button>
      ),
    ],
  });
});

app.frame("/methods", async (c) => {
  let { buttonValue } = c;

  if (buttonValue == "from") {
    return c.res({
      image: <S m={"Shortcuts: usdc, usdt, arb, bloo"} t1={ethDetails} />,
      intents: [
        <TextInput placeholder="Contract Address or Shortcut" />,
        <Button value="from" action="/token">
          Next ➡️
        </Button>,
        <Button.Reset>Home 🏠</Button.Reset>,
      ],
    });
  }

  return c.res({
    image: <S m={"Shortcuts: usdc, usdt, arb, bloo"} t2={ethDetails} />,
    intents: [
      <TextInput placeholder="Contract Address or Shortcut" />,
      <Button action="/token" value="to">
        Next ➡️
      </Button>,
      <Button.Reset>Home 🏠</Button.Reset>,
    ],
  });
});

function getHeading(method: string) {
  return method === "from" ? "Preview Purchase" : "Preview Sell";
}

app.frame("/token",  async (c: StartFrameContext) => {
  const { inputText, buttonValue } = c;
  let ca = getTokenAddress(inputText);
  let method = buttonValue;

  if (!method) method = "from";
  // if (!ca) ca = DEFAULT_TOKEN_CA;
  console.log({ ca });
  if (!ca) ca = DEFAULT_TOKEN_CA;

  return handleTokenDetails(c, ca, method);
});
app.frame("/exact_token/:ca",  async (c: StartFrameContext) => {
  let { buttonValue } = c;
  let method = "from";
  let ca = getTokenAddress(c.req.param("ca"));

  if (buttonValue && buttonValue.includes("-")) {
    method = buttonValue.split("-")[0].trim();
  }
  if (!ca) ca = DEFAULT_TOKEN_CA;
  return handleTokenDetails(c, ca, method);
});

app.frame("/confirm/:ca",  async (c: StartFrameContext) => {
  const { buttonValue, previousState } = c;
  console.log({ previousState });
  let method = buttonValue;
  if (!method) method = "from";
  const ca = c.req.param("ca");
  if (!ca) throw new Error("Contract address missing");
  let { inputText: tokenAmount } = c;
  let tokenAmountAsNumber = Number(tokenAmount);
  console.log({ tokenAmount });
  if (isNaN(tokenAmountAsNumber) || tokenAmountAsNumber == 0 || !tokenAmount) {
    tokenAmount = "0.01";
    tokenAmountAsNumber = Number(tokenAmount);
  }

  const baseUrl = `https://arbitrum.api.0x.org/swap/v1/price?`;
  const eth = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  let token1 = method === "from" ? eth : ca;
  let token2 = method === "from" ? ca : eth;
  const { token1: t1State, token2: t2State } = c.previousState;
  let sellDecimals = "18";
  if (t1State && t2State) {
    sellDecimals = method == "from" ? "18" : t1State.dec;
  }

  let sellAmount =
    sellDecimals === "18"
      ? parseEther(tokenAmount).toString()
      : `${tokenAmountAsNumber * Number(`1e${sellDecimals}`)}`;

  let res: Response | null = null;
  console.log({ sellAmount });
  const params = new URLSearchParams({
    sellToken: token1,
    buyToken: token2,
    sellAmount,
  }).toString();

  // fs.writeFileSync("price.json", JSON.stringify(priceData, null, 2));
  const fetcher = fetch(baseUrl + params, {
    headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" },
  });

  if (method === "from") {
    if (!t1State || !t2State) {
      return c.res({
        image: <S m={"Leave blank for $ARB"} t1={ethDetails} />,
        intents: [
          <TextInput placeholder="Enter Contract Address e.g: 0x.." />,
          <Button value="from" action="/token">
            Next ➡️
          </Button>,
          <Button.Reset>Home 🏠</Button.Reset>,
        ],
      });
    }
    try {
      res = await fetcher;
      if (!res.ok) throw new Error("Something went wrong fetching order");
    } catch (error) {
      console.log({ error });
      return c.res({
        image: (
          <S
            m={"Leave blank for $ARB"}
            t2={ethDetails}
            t1={{ tokenLogo: t1State.logo, tokenSymbol: t1State.sym }}
          />
        ),
        intents: [
          <TextInput placeholder="Enter Token Address e.g: 0x.." />,
          <Button action="/token" value="to">
            Next ➡️
          </Button>,
          <Button.Reset>Home 🏠</Button.Reset>,
        ],
      });
    }
  } else {
    if (!t1State || !t2State) {
      return c.res({
        image: <S m={"Leave blank for $ARB"} t2={ethDetails} />,
        intents: [
          <TextInput placeholder="Enter Token Address e.g: 0x.." />,
          <Button action="/token" value="to">
            Next ➡️
          </Button>,
          <Button.Reset>Home 🏠</Button.Reset>,
        ],
      });
    }

    try {
      res = await fetcher;
      if (!res.ok) throw new Error("Something went wrong fetching order");
    } catch (error) {
      console.log({ error });
      return c.res({
        image: (
          <S
            m={"Leave blank for $ARB"}
            t2={ethDetails}
            t1={{ tokenLogo: t1State.logo, tokenSymbol: t1State.sym }}
          />
        ),
        intents: [
          <TextInput placeholder="Enter Token Address e.g: 0x.." />,
          <Button action="/token" value="to">
            Next ➡️
          </Button>,
          <Button.Reset>Home 🏠</Button.Reset>,
        ],
      });
    }
  }
  let priceData: ZeroxSwapPriceData | null;

  let token1PriceData = {
    tokenLogo: t1State.logo,
    tokenSymbol: t1State.sym,
  };
  let token2PriceData = {
    tokenLogo: t2State.logo,
    tokenSymbol: t2State.sym,
  };

  try {
    priceData = (await res.json()) as ZeroxSwapPriceData;
  } catch (error) {
    console.log({ error });
    console.log("Price Data error in confirm");
    return c.res({
      image: (
        <S
          t1={{ tokenLogo: t1State.logo, tokenSymbol: t1State.sym }}
          t2={{ tokenLogo: t2State.logo, tokenSymbol: t2State.sym }}
        />
      ),
      // image: dummyImage,
      intents: [
        <TextInput placeholder={`Amount (in ${t1State.sym})`} />,
        <Button value={method} action={`/confirm/${ca}`}>
          Next ➡️
        </Button>,
        <Button value={method} action="/methods">
          ⬅️ Back
        </Button>,
      ],
    });
  }

  // console.log({priceData})
  const tokenAmountReceived = Number(priceData.price) * tokenAmountAsNumber;
  console.log({ tokenAmountReceived });
  console.log(priceData.price);
  const action =
    method === "from"
      ? `/finish/${t1State.sym}/${t1State.sym}/${tokenAmount}/${tokenAmountReceived}`
      : `/a/${token1}/${token2}/${tokenAmountAsNumber}`;
  const transactionTarget =
    method === "from" ? `/tx/${method}/${ca}/${tokenAmount}` : `/approve/${ca}`;

  return c.res({
    action,
    image: (
      <S
        sA={tokenAmountAsNumber}
        rA={tokenAmountReceived}
        t1={{ ...token1PriceData, usdPrice: t1State.usd }}
        t2={token2PriceData}
      />
    ),

    intents: [
      <Button.Transaction target={transactionTarget}>
        {method == "from"
          ? "Confirm Swap"
          : `Approve ${token1PriceData.tokenSymbol}`}
      </Button.Transaction>,
      method == "from" ? (
        <Button action={`/exact_token/${ca}`}>⬅️ Back</Button>
      ) : (
        <Button value={`to-${ca}`} action={`/exact_token/${ca}`}>
          ⬅️ Back
        </Button>
      ),
    ],
  });
});

// type RemoveNull<T> =
//   T extends null
//   ? never
//   :T extends object
//   ? {
//     [key in keyof T ]: RemoveNull<T[key]>
//   }
//   : T

type SwapDetails = {
  t1: string;
  t2: string;
  sA: number;
  rA: number;
  id: `0x${string}`;
};

const formatDate = (date: Date) => {
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  //@ts-ignore
  return new Intl.DateTimeFormat("en-US", options).format(date);
};

async function addUser(userId: string, tx: SwapDetails) {
  const now = formatDate(new Date());

  const tKey = nanoid();
  const uKey = `user:${userId}:tx:${tKey}`;
  console.log({ uKey });
  try {
    const r1 = await kvStore.set(uKey, JSON.stringify({ ...tx, date: now }));
    console.log("Done setting tx", r1);
  } catch (error) {
    console.log({ error });
    console.log("Error setting user transaction in store");
    return false;
  }

  const uListKey = `user:${userId}:txs`;
  console.log({ uListKey });
  try {
    const l1 = await kvStore.rpush(uListKey, tKey);
    console.log("Transaction key added to user list", l1);
  } catch (error) {
    console.log({ error });
    console.log("There was an issue add to the user list");
    return false;
  }

  return true;
}

app.frame("/finish",  async (c: StartFrameContext) => {
  const { transactionId, frameData, previousState } = c;

  const { token1, token2, sendAmount, receiveAmount } = previousState;
  console.log(previousState, frameData, transactionId);

  if (
    token1 &&
    token2 &&
    sendAmount &&
    receiveAmount &&
    frameData &&
    transactionId
  ) {
    const fid = frameData.fid;
    const res = await addUser(`${fid}`, {
      t1: token1.sym,
      t2: token2.sym,
      sA: sendAmount,
      rA: receiveAmount,
      id: transactionId,
    });
    console.log(res);
  }

  const explorerLink = `https://arbiscan.io/tx/${transactionId}`;
  console.log({ transactionHash: explorerLink });

  return c.res({
    image: "https://pbs.twimg.com/media/F4M9IOlWwAEgTDf.jpg",
    intents: [
      <Button.Link href={explorerLink}>View Transaction</Button.Link>,
      <Button.Reset>Home 🏠</Button.Reset>,
    ],
  });
});

app.frame("/finish/:t1/:t2/:sA/:rA",  async (c) => {
  let { t1, t2, sA: sAString, rA: rAString } = c.req.param();
  const { frameData, transactionId } = c;
  const sA = Number(sAString);
  const rA = Number(rAString);

  if (t1 && t2 && sA && rA && frameData && transactionId) {
    const fid = frameData.fid;
    const res = await addUser(`${fid}`, {
      t1,
      t2,
      sA,
      rA,
      id: transactionId,
    });
    console.log(res);
  }

  const explorerLink = `https://arbiscan.io/tx/${transactionId}`;
  console.log({ transactionHash: explorerLink });

  return c.res({
    image: "https://pbs.twimg.com/media/F4M9IOlWwAEgTDf.jpg",
    intents: [
      <Button.Link href={explorerLink}>View Transaction</Button.Link>,
      <Button.Reset>Home 🏠</Button.Reset>,
    ],
  });
});

app.transaction("/approve/:ca",  async (c) => {
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

app.transaction("/sell/:token1/:token2/:amount",  async (c) => {
  console.log("I am in sell");
  const token1 = c.req.param("token1");
  const token2 = c.req.param("token2");
  let amount = c.req.param("amount");
  console.log({ token1, token2, amount });
  if (!token1 || !token2 || !amount) throw new Error("Values missing");
  if (isNaN(Number(amount)) || Number(amount) == 0) amount = "0.1";

  const { token1: t1State, token2: t2State } = c.previousState;
  let sellDecimals = "18";
  if (t1State && t2State) {
    sellDecimals = t1State.dec;
  }
  let sellAmount =
    sellDecimals === "18"
      ? parseEther(amount).toString()
      : `${Number(amount) * Number(`1e${sellDecimals}`)}`;

  const params = new URLSearchParams({
    sellToken: token1,
    buyToken: token2,
    sellAmount,
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

function formatNumber(num: number, decimals = 4) {
  if (Number.isInteger(num)) {
    return num;
  } else {
    return num.toFixed(decimals);
  }
}

function S({
  t1: t1,
  t2: t2,
  sA: sA,
  rA: rA,
  m,
  e,
}: {
  t1?: {
    tokenLogo: string;
    tokenSymbol: string;
    usdPrice?: number;
  } & Partial<TokenDetails>;
  t2?: {
    tokenLogo: string;
    tokenSymbol: string;
    usdPrice?: number;
  } & Partial<TokenDetails>;
  sA?: number;
  rA?: number;
  m?: string;
  e?: boolean;
}) {
  const t1Logo = t1 ? t1.tokenLogo : dummyImage;
  const t2Logo = t2 ? t2.tokenLogo : dummyImage;
  const t1Symbol = t1 ? t1.tokenSymbol : "???";
  const t1UsdValue = t1 ? t1.usdPrice && sA ? formatNumber(t1.usdPrice * sA, 2) : "" : "";
  const t2Symbol = t2 ? t2.tokenSymbol : "???";
  const saValue = sA ? formatNumber(sA) : "??";
  const raValue = rA ? formatNumber(rA) : "??";

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
      <span tw="text-6xl my-2 mx-auto ">Preview Swap</span>
      <div
        tw="flex items-center  mx-auto justify-between max-w-4/5 w-full flex-col"
        style={{
          gap: "10px",
        }}
      >
        <div tw="flex justify-between py-4  w-full items-center">
          <div tw="rounded-full flex w-[150px] h-[150px] overflow-hidden ">
            <img
              src={t1Logo}
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
          <div tw="rounded-full flex w-[150px] h-[150px] overflow-hidden ">
            <img
              src={t2Logo}
              width={"100%"}
              height={"100%"}
              style={{
                objectFit: "cover",
              }}
            />
          </div>
        </div>

        <div tw="flex w-full justify-between pl-9 pr-10">
          <span tw="ml-2">{t1Symbol}</span>
          <span>{t2Symbol}</span>
        </div>
      </div>
      <hr tw="py-[1px] w-full bg-gray-800" />

      <div tw="flex justify-between py-3">
        <div tw="text-gray-400">You spend</div>
        <div tw="flex text-4xl items-center" style={{ gap: "4px" }}>
          <span>You receive</span>
        </div>
      </div>
      <div tw="flex justify-between py-3">
        <span tw="text-gray-400 flex">{`${saValue} ${t1Symbol} ${t1UsdValue ? `($${t1UsdValue})`: ""}` }</span>
        <span tw="text-4xl flex" style={{ gap: "10px" }}>
          <span>{raValue} </span>
          <span>{t2Symbol}</span>
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
      {m ? (
        <div tw="absolute bottom-10 w-full flex justify-center rounded-full mx-auto">
          <span
            tw={`w-3/5 flex justify-center rounded-xl py-2 ${
              e ? "bg-red-400" : "bg-green-600"
            }`}
          >
            {m}
          </span>
        </div>
      ) : (
        <div tw="hidden"></div>
      )}
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
        <span tw="text-gray-400 flex">{`${amountInEth} ETH ($${ethInUsd.toFixed(
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
