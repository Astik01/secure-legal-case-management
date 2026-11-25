export default async function globalTeardown() {
  globalThis.__HARDHAT__?.kill();
  await globalThis.__MONGO__?.stop();
}
