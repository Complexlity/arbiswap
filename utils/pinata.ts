import { PinataFDK } from "pinata-fdk";
import { config } from "dotenv";

config()

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY;

if (!PINATA_GATEWAY || !PINATA_JWT) {
  throw new Error("Pinata Details Missing");
}

console.log("Pinata is fine");

const fdk = new PinataFDK({
  pinata_jwt: PINATA_JWT,
  pinata_gateway: PINATA_GATEWAY,
});

export { fdk };
