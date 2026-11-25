import { ChildProcess, execFileSync, spawn } from 'child_process';
import { ContractFactory, JsonRpcProvider, Network, Wallet } from 'ethers';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';

declare global {
  // eslint-disable-next-line no-var
  var __MONGO__: MongoMemoryServer | undefined;
  // eslint-disable-next-line no-var
  var __HARDHAT__: ChildProcess | undefined;
}

const CHAIN_PORT = 8546;
const RPC = `http://127.0.0.1:${CHAIN_PORT}`;
// Hardhat's public development account #0 (holds only fake local ETH).
export const HARDHAT_KEY_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const blockchainDir = path.resolve(__dirname, '../../blockchain');
const artifactPath = path.join(blockchainDir, 'artifacts/contracts/LegalDocumentRegistry.sol/LegalDocumentRegistry.json');
const hardhatBin = require.resolve('hardhat/internal/cli/bootstrap.js', { paths: [blockchainDir] });

async function waitForRpc(provider: JsonRpcProvider, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      await provider.getBlockNumber();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Hardhat node did not start in time');
}

export default async function globalSetup() {
  const mongo = await MongoMemoryServer.create();
  globalThis.__MONGO__ = mongo;
  process.env.MONGODB_URI = mongo.getUri();

  // Compile the contract if artifacts are missing, then start an isolated local blockchain.
  if (!fs.existsSync(artifactPath)) {
    execFileSync(process.execPath, [hardhatBin, 'compile'], { cwd: blockchainDir, stdio: 'inherit' });
  }
  const node = spawn(process.execPath, [hardhatBin, 'node', '--port', String(CHAIN_PORT)], {
    cwd: blockchainDir,
    stdio: 'ignore',
  });
  globalThis.__HARDHAT__ = node;

  const provider = new JsonRpcProvider(RPC, 31337, { staticNetwork: Network.from(31337) });
  await waitForRpc(provider);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const wallet = new Wallet(HARDHAT_KEY_0, provider);
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, wallet).deploy();
  await contract.waitForDeployment();

  const deploymentFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'legal-deploy-')), 'test.json');
  fs.writeFileSync(
    deploymentFile,
    JSON.stringify({ network: 'test', chainId: 31337, address: await contract.getAddress(), abi: artifact.abi }),
  );
  provider.destroy();

  process.env.BLOCKCHAIN_RPC_URL = RPC;
  process.env.BLOCKCHAIN_DEPLOYMENT_FILE = deploymentFile;
  process.env.BLOCKCHAIN_PRIVATE_KEY = HARDHAT_KEY_0;
}
