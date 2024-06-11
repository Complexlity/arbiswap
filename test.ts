import { zeroxSDK } from "./utils/services.js";
// @ts-expect-error
import order from "./order.js";
import fs from "fs";
import { createPublicClient, http, parseAbiItem } from "viem";
import { arbitrum } from "viem/chains";
import {
  walletClient as client,
  arbitrumClient as publicClient,
} from "./src/index.js";
import { ZeroxSwapQuoteOrder } from "./utils/types.js";

const sellTokenAddress = "0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3";
const buyTokenAddress = "0x88a269Df8fe7F53E590c561954C52FCCC8EC0cFB";
const params = new URLSearchParams({
  sellToken: sellTokenAddress,
  buyToken: buyTokenAddress,
  sellAmount: "40000000000000000000000",
  takerAddress: "0xe06Dacf8a98CBbd9692A17fcb8e917a6cb5e65ED",
});

//  console.log({params})

// const params = new URLSearchParams({
//   buyTo)ken: token1,
//   sellToken: token2,
//   sellAmount: parseEther(tokenAmount).toString(),
// }).toString();

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

// Address of the ERC20 token contract

// Create a contract instance
const ERC20TokenContract = {
  address: sellTokenAddress,
  abi: ERC20TokenAbi,
};

// console.log("setup ERC20TokenContract: ", ERC20TokenContract);
// Calculate the max approval amount using BigInt
const maxApproval = BigInt(2) ** BigInt(256) - BigInt(1);
console.log("approval amount: ", maxApproval.toString());

// Grant the allowance target an allowance to spend our tokens
const contract = {
  address: ERC20TokenContract.address as `0x${string}`,
  abi: ERC20TokenContract.abi,
  functionName: "approve",
  args: ["0xdef1c0ded9bec7f1a1670819833240f027b25eff", maxApproval],
  account: client.account,
};

const { request } = await publicClient.simulateContract(contract);
const approveTx = await client.writeContract(request);

console.log("approveTx: ", approveTx);
const swapQuoteJSON = (await zeroxSDK(
  "quote",
  params,
  "arbitrum"
)) as ZeroxSwapQuoteOrder;

console.log(swapQuoteJSON.to);
const transaction = {
  to: swapQuoteJSON.to,
  data: swapQuoteJSON.data,
  from: "0xe06Dacf8a98CBbd9692A17fcb8e917a6cb5e65ED",
  value: "0",
};

// console.log({ transaction })
const swapTx = await client.sendTransaction(transaction);

// console.log("Swap Transaction Hash", swapTx);

console.log("swapTx: ", swapTx);
