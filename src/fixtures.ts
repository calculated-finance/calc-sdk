export enum Environment {
  THORCHAIN_STAGENET_2 = "thorchain-stagenet-2",
  THORCHAIN_MAINNET = "thorchain-mainnet",
}

export const Config = {
  [Environment.THORCHAIN_STAGENET_2]: {
    managerAddress:
      "sthor18e35rm2dwpx3h09p7q7xx8qfvwdsxz2ls92fdfd4j7vh6g55h8ash7gkau",
    schedulerAddress:
      "sthor14zd6glgu67mg2ze7ekqtce3r7yjuk846l3982en9y5v6nlh2y5es2llpa6",
  },
  [Environment.THORCHAIN_MAINNET]: {
    managerAddress: "thor1...mgr",
    schedulerAddress: "thor1...schdlr",
  },
};
