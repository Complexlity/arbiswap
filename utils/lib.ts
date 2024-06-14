export function ethereumToUrlSafeBase64(address: string) {
  // Remove the '0x' prefix
  const hexAddress = address.slice(2);
  // Convert hex to bytes
  const byteAddress = Buffer.from(hexAddress, "hex");
  // Encode to Base64
  let base64Address = byteAddress.toString("base64");
  // Convert to URL-safe Base64
  base64Address = base64Address
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64Address;
}

export function urlSafeBase64ToEthereum(encoded: string) {
  // Convert from URL-safe Base64 to standard Base64
  let base64Address = encoded.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding back if needed
  while (base64Address.length % 4 !== 0) {
    base64Address += "=";
  }
  // Decode from Base64 to bytes
  const byteAddress = Buffer.from(base64Address, "base64");
  // Convert bytes to hex
  const hexAddress = byteAddress.toString("hex");
  // Add the '0x' prefix
  const ethAddress = "0x" + hexAddress;
  return ethAddress;
}

// const ethAddress = "0x912CE59144191C1204E64559FE8253a0e49E6548";
// const encodedAddress = ethereumToUrlSafeBase64(ethAddress);
// console.log("Encoded:", encodedAddress); // "r4jQZe6ejsIjkyfF7bOkMiY4WDE"

// const decodedAddress = urlSafeBase64ToEthereum(encodedAddress);
// console.log("Decoded:", decodedAddress); // "0xaf88d065e77c8cC2239327C5EDb3A432268
