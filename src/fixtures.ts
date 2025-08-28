export enum Environment {
  THORCHAIN_STAGENET_2 = "thorchain-stagenet-2",
  THORCHAIN_MAINNET = "thorchain-mainnet",
}

export const Config = {
  [Environment.THORCHAIN_STAGENET_2]: {
    managerAddress:
      "sthor1sws3r2t5zecjskzh8n5plk8yhpxm2grtm0tthqljl02qgklfemhqhfnkpr",
    schedulerAddress:
      "sthor1yya2jk2upk6ncxmr7ugg3mt9dlxy2zgxpea2yxerdje7hr5tmn2qsktr5z",
  },
  [Environment.THORCHAIN_MAINNET]: {
    managerAddress: "thor1...mgr",
    schedulerAddress: "thor1...schdlr",
  },
};
