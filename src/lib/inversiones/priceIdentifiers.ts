const CRYPTO_IDS: Record<string, string> = {
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  BTC: 'bitcoin',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  ETH: 'ethereum',
  LINK: 'chainlink',
  MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token',
  SOL: 'solana',
  STETH: 'staked-ether',
  WBTC: 'wrapped-bitcoin',
  XRP: 'ripple',
}

const YAHOO_SYMBOLS: Record<string, string> = {
  SXR8: 'SXR8.DE',
  IS3N: 'IS3N.DE',
  '4COP': '4COP.DE',
  '2B76': '2B76.DE',
  Q8Y0: 'Q8Y0.DE',
}

export function priceIdentifiers(assetType: string, ticker: string) {
  const normalizedTicker = ticker.trim().toUpperCase()
  const isCrypto = assetType.toLowerCase().includes('crypto')

  if (isCrypto) {
    return {
      cryptoId: CRYPTO_IDS[normalizedTicker] ?? null,
      marketSymbol: null,
    }
  }

  return {
    cryptoId: null,
    marketSymbol: YAHOO_SYMBOLS[normalizedTicker] ?? normalizedTicker,
  }
}
