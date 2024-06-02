const nativePrice = "1031929720801306000000000000000000"; // Native price in wei
const usdPrice = 3.907223311282702; // USD price

// Convert the native price to a number in ETH
const nativePriceInETH = BigInt(nativePrice) / BigInt("1000000000000000000");

// Calculate the price of 1 ETH in USD
const ethPriceInUSD = (usdPrice / Number(nativePriceInETH)) * 1e18;

console.log(`The price of 1 ETH in USD is: ${ethPriceInUSD}`);
