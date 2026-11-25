import { ethers, network, artifacts } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory('LegalDocumentRegistry');
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const artifact = await artifacts.readArtifact('LegalDocumentRegistry');
  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };
  const dir = path.resolve(__dirname, '../deployments');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(process.env.DEPLOYMENT_FILE || path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2));
  console.log(`LegalDocumentRegistry deployed to ${address} on ${network.name}`);
  console.log(`Deployment file: deployments/${network.name}.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
