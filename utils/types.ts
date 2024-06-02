export interface ZeroxSwapPriceData {
    chainId:              number;
    price:                string;
    grossPrice:           string;
    estimatedPriceImpact: string;
    value:                string;
    gasPrice:             string;
    gas:                  string;
    estimatedGas:         string;
    protocolFee:          string;
    minimumProtocolFee:   string;
    buyTokenAddress:      string;
    buyAmount:            string;
    grossBuyAmount:       string;
    sellTokenAddress:     string;
    sellAmount:           string;
    grossSellAmount:      string;
    sources:              Source[];
    allowanceTarget:      string;
    sellTokenToEthRate:   string;
    buyTokenToEthRate:    string;
    fees:                 Fees;
    auxiliaryChainData:   AuxiliaryChainData;
}

export interface AuxiliaryChainData {
}

export interface Fees {
    zeroExFee: ZeroExFee;
}

export interface ZeroExFee {
    feeType:     string;
    feeToken:    string;
    feeAmount:   string;
    billingType: string;
}

export interface Source {
    name:       string;
    proportion: string;
}


export interface ZeroxSwapQuoteOrder {
    chainId:              number;
    price:                string;
    grossPrice:           string;
    estimatedPriceImpact: string;
    value:                string;
    gasPrice:             string;
    gas:                  string;
    estimatedGas:         string;
    protocolFee:          string;
    minimumProtocolFee:   string;
    buyTokenAddress:      string;
    buyAmount:            string;
    grossBuyAmount:       string;
    sellTokenAddress:     string;
    sellAmount:           string;
    grossSellAmount:      string;
    sources:              Source[];
    allowanceTarget:      string;
    sellTokenToEthRate:   string;
    buyTokenToEthRate:    string;
    to:                   `0x${string}`;
    data:                 `0x${string}`;
    decodedUniqueId:      string;
    guaranteedPrice:      string;
    orders:               Order[];
    fees:                 Fees;
    auxiliaryChainData:   AuxiliaryChainData;
}

export interface AuxiliaryChainData {
}

export interface Fees {
    zeroExFee: ZeroExFee;
}

export interface ZeroExFee {
    feeType:     string;
    feeToken:    string;
    feeAmount:   string;
    billingType: string;
}

export interface Order {
    type:        number;
    source:      string;
    makerToken:  string;
    takerToken:  string;
    makerAmount: string;
    takerAmount: string;
    fillData:    FillData;
    fill:        Fill;
}

export interface Fill {
    input:          string;
    output:         string;
    adjustedOutput: string;
    gas:            number;
}

export interface FillData {
    router:            string;
    tokenAddressPath?: string[];
    binStepRoute?:     number[];
    gasUsed:           number;
    path?:             string;
    routerVersion?:    number;
}

export interface Source {
    name:       string;
    proportion: string;
}
