import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { SEPOLIA_RPC_URL, SEPOLIA_DEPLOYER_PRIVATE_KEY } = process.env;

const config: HardhatUserConfig = {
  solidity: { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat: {},
    localhost: { url: process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545' },
    // Optional; only active when both variables are provided. Needs Sepolia test ETH.
    ...(SEPOLIA_RPC_URL && SEPOLIA_DEPLOYER_PRIVATE_KEY
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [SEPOLIA_DEPLOYER_PRIVATE_KEY] } }
      : {}),
  },
};
export default config;
