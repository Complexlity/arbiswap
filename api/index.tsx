/** @jsxImportSource frog/jsx */


import { Button, FrameContext, Frog, TextInput } from 'frog'
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
import { ZeroxSwapQuoteOrder } from '../utils/types.js';

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }
const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});


export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
})

app.frame('/', async (c) => {
  
  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background: "black",
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "1rem",
            color: 'white',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          Welcome Home {" "}

        </div>
      </div>
    ),
    intents: [
      <TextInput placeholder="Enter contract address" />,
      <Button action="/token">Go</Button>,
    ],
  })
})


async function handleToken(c: FrameContext) {
  const {inputText} = c
  let ca = c.req.param('ca')
  if(!ca) ca = inputText
  console.log({ca})
  let token = null
  let usd = 42
  if(ca){
token = await getTokenPrice(ca)
usd= convertTokenAmountToUSD(100000, token) ?? '42'
  }

console.log(token?.tokenLogo)
  // console.log({token, usd})
  return c.res({
    image: token ? 
    <ConvertImage token={token} usd={`${usd}`}  />
    : 
    <ErrorImage />,
    intents:  token ?
    [
      <TextInput placeholder='Enter amount in eth' />
,      <Button action={`/confirm/${ca}`}>Proceed</Button>,
      <Button.Reset>Back</Button.Reset>
    ]
    : [
      <TextInput placeholder='Enter contract address'/>,
      <Button>Retry</Button>
    ]
  })
}


app.frame('/token', 
handleToken)

app.frame('/confirm/:ca', async (c) => {
  
  const ca = c.req.param("ca")
  if(!ca) throw new Error("Contract address missing")
  let { inputText: ethAmount } = c;
  let ethAmountAsNumber = Number(ethAmount);
  if (isNaN(ethAmountAsNumber) || ethAmountAsNumber == 0 || !ethAmount) {
    ethAmount = "0.01"
    ethAmountAsNumber = Number(ethAmount)
  }

  console.log({ethAmount})

  const baseUrl = `https://arbitrum.api.0x.org/swap/v1/quote?`
  const eth = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  let tokenPriceData = await getTokenPrice(ca);
  

  const params = new URLSearchParams({
    buyToken: ca,
    sellToken: eth,
    sellAmount: parseEther(ethAmount).toString(),
    feeRecipient: "0x8ff47879d9eE072b593604b8b3009577Ff7d6809",
    buyTokenPercentageFee: "0.01",
  }).toString();


  const res = await fetch(baseUrl + params, {
    headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" },
  });

  const order = (await res.json()) as ZeroxSwapQuoteOrder
  const tokenAmountReceived = `${Number(order.price) * Number(ethAmount)}`
  const ethAmountInUsd = getEthPrice(tokenPriceData?.nativePrice!, tokenPriceData?.usdPrice!
    , ethAmountAsNumber
  )


  return c.res({
    image: <PreviewImage ethInUsd={ethAmountInUsd} token={tokenPriceData!} amountInEth={ethAmount} amountReceived={tokenAmountReceived} />,
    intents: [
    <Button>Confirm</Button>,
      <Button.Reset>Back</Button.Reset>
  ]
  })
})

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
        <div tw="flex justify-between py-2  w-full">
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

        <div tw="flex w-full justify-between">
          <span>ETH</span>
          <span>{token.tokenSymbol}</span>
        </div>
      </div>
      <hr tw="py-[1px] w-full bg-gray-800" />

      <div tw="flex justify-between py-2">
        <div tw="text-gray-400">Spend</div>
        <div tw="flex text-4xl items-center" style={{ gap: "4px" }}>
          <img src={token.tokenLogo} width={50} height={50} />
          <span>Receive</span>
        </div>
      </div>
      <div tw="flex justify-between py-2">
        <span tw="text-gray-400 flex gap-2">{`${amountInEth}/$${ethInUsd}`}</span>
        <span tw="text-4xl flex" style={{gap:"10px"}}>
          <span>(${amountReceived})</span>
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
          alignItems: 'center',
          background: "black",
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "1rem",
            color: 'white',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          Token not found
        </div>
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




// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined'
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)
