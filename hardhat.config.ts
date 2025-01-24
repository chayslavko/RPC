require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const config = {
  solidity: "0.8.19",
  // networks: {
  //   sepolia: {
  //     url: process.env.SEPOLIA_RPC_URL,
  //     // accounts: [process.env.PRIVATE_KEY].filter(Boolean),
  //     chainId: 11155111
  //   },
  // },
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY,
  // },
};

module.exports = config;