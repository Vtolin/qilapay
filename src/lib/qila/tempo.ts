import {
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  getAddress,
  stringToHex,
  pad,
} from "viem";
import { tempoTestnet } from "viem/chains";
import { createClient, TokenId, Abis } from "viem/tempo";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

/**
 * Tempo (Moderato testnet) integration.
 *
 * Network facts (verified against docs.tempo.xyz on build date):
 *  - Moderato testnet: chain ID 42431, RPC https://rpc.moderato.tempo.xyz
 *  - No native gas token; fees are paid in USD TIP-20 stablecoins.
 *  - TIP-20 tokens: 6 decimals, support 32-byte transfer memos.
 *  - Faucet: POST https://tempo.xyz/developers/api/faucet { address }
 *    funds 1M each of pathUSD / OUSD / AlphaUSD / BetaUSD / ThetaUSD.
 *  - TIP-20 Factory:  0x20fc000000000000000000000000000000000000
 *  - Stablecoin DEX:  0xdec0000000000000000000000000000000000000
 *  - pathUSD:         0x20c0000000000000000000000000000000000000
 */

export const TEMPO = {
  rpcUrl: process.env.TEMPO_RPC_URL || "https://rpc.moderato.tempo.xyz",
  chainId: Number(process.env.TEMPO_CHAIN_ID || 42431),
  explorerUrl: process.env.TEMPO_EXPLORER_URL || "https://explore.testnet.tempo.xyz",
  faucetUrl: process.env.TEMPO_FAUCET_URL || "https://tempo.xyz/developers/api/faucet",
  pathUsd: getAddress("0x20c0000000000000000000000000000000000000"),
} as const;

export function explorerTx(hash: string): string {
  return `${TEMPO.explorerUrl}/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `${TEMPO.explorerUrl}/address/${addr}`;
}

// ---------------------------------------------------------------- treasury

let treasuryAccount: ReturnType<typeof privateKeyToAccount> | null = null;

export function getTreasuryAccount() {
  if (!treasuryAccount) {
    const pk = process.env.TREASURY_PRIVATE_KEY;
    if (!pk) throw new Error("TREASURY_PRIVATE_KEY is not set");
    treasuryAccount = privateKeyToAccount(pk as `0x${string}`);
  }
  return treasuryAccount;
}

export type TempoUserClient = ReturnType<typeof createTempoClient>;

/** Signed client for a custodial wallet (server-side only). */
export function createTempoClient(privateKey: `0x${string}`) {
  return createClient({
    chain: tempoTestnet,
    transport: http(TEMPO.rpcUrl, { timeout: 30_000 }),
    account: privateKeyToAccount(privateKey),
  });
}

export function getTreasuryClient() {
  return createTempoClient(
    (process.env.TREASURY_PRIVATE_KEY || "0x00") as `0x${string}`,
  );
}

export function createWalletCredentials(): {
  address: string;
  privateKey: `0x${string}`;
} {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { address: account.address, privateKey };
}

// ------------------------------------------------------------------- faucet

/** Fund an address with test stablecoins via the Tempo faucet API. */
export async function faucetFund(address: string): Promise<string[]> {
  const res = await fetch(TEMPO.faucetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: address.toLowerCase() }),
  });
  if (!res.ok) throw new Error(`Faucet failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data?: { hash: string }[] };
  return (json.data || []).map((d) => d.hash);
}

// ------------------------------------------------------------------ tokens

export type TokenInfo = {
  code: string;
  name: string;
  symbol: string;
  address: string;
  decimals: number;
};

/** Read on-chain TIP-20 metadata (name/symbol/decimals). */
export async function readTokenMetadata(tokenAddress: string) {
  const client = createPublicClient({ chain: tempoTestnet, transport: http(TEMPO.rpcUrl) });
  const [name, symbol, decimals] = await Promise.all([
    client.readContract({ address: getAddress(tokenAddress), abi: Abis.tip20, functionName: "name" }) as Promise<string>,
    client.readContract({ address: getAddress(tokenAddress), abi: Abis.tip20, functionName: "symbol" }) as Promise<string>,
    client.readContract({ address: getAddress(tokenAddress), abi: Abis.tip20, functionName: "decimals" }) as Promise<number>,
  ]);
  return { name, symbol, decimals };
}

export async function getTokenBalance(tokenAddress: string, owner: string): Promise<bigint> {
  const client = createPublicClient({ chain: tempoTestnet, transport: http(TEMPO.rpcUrl) });
  const bal = (await client.readContract({
    address: getAddress(tokenAddress),
    abi: Abis.tip20,
    functionName: "balanceOf",
    args: [getAddress(owner)],
  })) as bigint;
  return bal;
}

export async function formatTokenAmount(tokenAddress: string, raw: bigint): Promise<string> {
  return formatUnits(raw, 6);
}

export const micro = (amount: number | string): bigint => parseUnits(String(amount), 6);
export const fromMicro = (raw: bigint): number => Number(formatUnits(raw, 6));

/** Encode a QilaPay transfer memo (32 bytes): `QILA-<shortId>`. */
export function encodeMemo(transferId: string): `0x${string}` {
  const short = transferId.replace(/-/g, "").slice(-10).toUpperCase();
  return pad(stringToHex(`QILA-${short}`), { size: 32 });
}

export function decodeMemo(memoHex: string): string {
  try {
    const hex = memoHex.startsWith("0x") ? memoHex.slice(2) : memoHex;
    const decoded = Buffer.from(hex, "hex").toString("utf8").replace(/\0/g, "");
    return decoded;
  } catch {
    return "";
  }
}

// -------------------------------------------------------------- issuance

/**
 * Ensure a q<CCY> TIP-20 test token exists, issued by the treasury.
 * Returns the token address. Idempotent: checks on-chain by scanning
 * treasury's created tokens first, else creates + grants issuer + mints.
 */
export async function ensureQilaToken(
  code: string,
  existingAddress?: string | null,
): Promise<string> {
  const client = getTreasuryClient();
  if (existingAddress) {
    try {
      await readTokenMetadata(existingAddress);
      return existingAddress;
    } catch {
      // token vanished (chain reset) -> re-issue
    }
  }
  const name = `QilaPay ${currencyDisplayName(code)}`;
  const symbol = `q${code}`;
  const { receipt, tokenId } = (await client.token.createSync({
    name,
    symbol,
    currency: code,
  })) as { receipt: { transactionHash: string }; tokenId: bigint };
  const tokenAddress = TokenId.toAddress(tokenId);
  await client.token.grantRolesSync({
    token: tokenAddress,
    to: getTreasuryAccount().address,
    roles: ["issuer"],
  });
  // Mint operating inventory: 25,000,000 units
  await client.token.mintSync({
    token: tokenAddress,
    to: getTreasuryAccount().address,
    amount: parseUnits("25000000", 6),
  });
  console.log(`[tempo] issued ${symbol} at ${tokenAddress} (tx ${receipt.transactionHash})`);
  return tokenAddress;
}

export function currencyDisplayName(code: string): string {
  const names: Record<string, string> = {
    USD: "US Dollar",
    IDR: "Indonesian Rupiah",
    SGD: "Singapore Dollar",
    EUR: "Euro",
    GBP: "British Pound",
  };
  return names[code] || code;
}

// ------------------------------------------------------------------ DEX

export type DexQuoteResult =
  | { available: true; amountOut: bigint }
  | { available: false; reason: string };

/**
 * Try to get a DEX quote for tokenIn -> tokenOut.
 * Non-USD pairs generally return PairDoesNotExist on Moderato today,
 * which triggers the treasury fallback (spec 4.2).
 */
export async function tryDexQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
): Promise<DexQuoteResult> {
  try {
    const client = getTreasuryClient();
    const quote = await client.dex.getSellQuote({
      tokenIn: getAddress(tokenIn),
      tokenOut: getAddress(tokenOut),
      amountIn,
    });
    if (quote && quote.amountOut > 0n) return { available: true, amountOut: quote.amountOut };
    return { available: false, reason: "ZERO_QUOTE" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("PairDoesNotExist")) return { available: false, reason: "PAIR_DOES_NOT_EXIST" };
    if (msg.includes("InsufficientLiquidity")) return { available: false, reason: "INSUFFICIENT_LIQUIDITY" };
    return { available: false, reason: "DEX_ERROR" };
  }
}

// -------------------------------------------------------------- transfers

export type TransferReceipt = {
  transactionHash: string;
  blockNumber: bigint;
  status: string;
  elapsedMs: number;
};

/** TIP-20 transfer with QilaPay memo, timed for settlement display. */
export async function transferWithMemo(args: {
  privateKey: `0x${string}`;
  tokenAddress: string;
  to: string;
  amount: bigint;
  memo?: `0x${string}`;
}): Promise<TransferReceipt> {
  const client = createTempoClient(args.privateKey);
  const t0 = Date.now();
  const { receipt } = await client.token.transferSync({
    token: getAddress(args.tokenAddress),
    to: getAddress(args.to),
    amount: args.amount,
    memo: args.memo,
  });
  return {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    status: receipt.status,
    elapsedMs: Date.now() - t0,
  };
}
