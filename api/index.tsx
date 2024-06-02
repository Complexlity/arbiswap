/** @jsxImportSource frog/jsx */


import { Button, Frog, TextInput } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'
// import { neynar } from 'frog/hubs'
import { handle } from 'frog/vercel'
import { convertTokenAmountToUSD, formatCurrency, getTokenPrice  } from '../utils/moralis.js'
import { imageUrls } from "../utils/images.js";


// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
})

app.frame('/', async (c) => {
  // const { buttonValue, inputText, status } = c
  const usdPrice =await convertTokenAmountToUSD(100000)
  console.log({usdPrice})
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
          {usdPrice}

        </div>
      </div>
    ),
    intents: [
      <TextInput placeholder="Enter contract address" />,
      <Button action="/convert">Go</Button>,
    ],
  })
})

app.frame("/convert", async (c) => {
  const { inputText } = c;
  let inputTextAsNumber = Number(inputText);
  let token: string;
  let usd: string;
  if (isNaN(inputTextAsNumber) || inputTextAsNumber == 0) {
    token = "0";
    usd = "0";
  } else {
    let tokenPriceData = await getTokenPrice();
    const amount = inputTextAsNumber * tokenPriceData.usdPrice;
    token = formatCurrency(inputTextAsNumber);
    usd = formatCurrency(amount, 11, 4);
  }

  return c.res({
    image: <ConvertImage token={token} usd={usd} />,
    intents: [
      <TextInput placeholder="token amount e.g 10000" />,
      <Button>Convert</Button>,
      <Button.Reset>Home</Button.Reset>,
    ],
  });
});



function ConvertImage({ token, usd }: { token: string; usd: string }) {
  usd = usd ?? "42";
  token = token ?? "42069";
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
            <img src={`${imageUrls.token}`} height={150} width={150} />
            <span tw={"text-4xl"}>token</span>
          </div>
          <span>{token}</span>
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
