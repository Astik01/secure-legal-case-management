import { expect } from 'chai';
import { ethers } from 'hardhat';
import { createHash } from 'crypto';

const sha = (s: string) => '0x' + createHash('sha256').update(s).digest('hex');
const docId = (s: string) => ethers.id(s);

describe('LegalDocumentRegistry', () => {
  async function setup() {
    const [owner, registrar, stranger] = await ethers.getSigners();
    const c = await (await ethers.getContractFactory('LegalDocumentRegistry')).deploy();
    await c.waitForDeployment();
    return { c, owner, registrar, stranger };
  }
  const ref = ethers.id('user-1');

  it('registers a document and records hash, uploader and timestamp', async () => {
    const { c, owner } = await setup();
    const id = docId('doc-1');
    await expect(c.registerDocument(id, sha('a'), ref)).to.emit(c, 'DocumentRegistered');
    const v = await c.getVersion(id, 1);
    expect(v.contentHash).to.equal(sha('a'));
    expect(v.registrar).to.equal(owner.address);
    expect(v.uploaderRef).to.equal(ref);
    expect(v.timestamp).to.be.gt(0);
    expect(await c.isRegistered(id)).to.equal(true);
    expect(await c.getHash(id, 1)).to.equal(sha('a'));
  });

  it('prevents duplicate registration of the same document id', async () => {
    const { c } = await setup();
    const id = docId('doc-1');
    await c.registerDocument(id, sha('a'), ref);
    await expect(c.registerDocument(id, sha('b'), ref)).to.be.revertedWithCustomError(c, 'AlreadyRegistered');
  });

  it('appends versions without overwriting history', async () => {
    const { c } = await setup();
    const id = docId('doc-1');
    await c.registerDocument(id, sha('a'), ref);
    await c.registerVersion(id, sha('b'), ref);
    await c.registerVersion(id, sha('c'), ref);
    expect(await c.getVersionCount(id)).to.equal(3);
    expect(await c.getHash(id, 1)).to.equal(sha('a'));
    expect(await c.getHash(id, 2)).to.equal(sha('b'));
    expect((await c.getLatest(id)).contentHash).to.equal(sha('c'));
  });

  it('rejects a version for an unregistered document and identical consecutive hashes', async () => {
    const { c } = await setup();
    const id = docId('doc-1');
    await expect(c.registerVersion(id, sha('a'), ref)).to.be.revertedWithCustomError(c, 'NotRegisteredYet');
    await c.registerDocument(id, sha('a'), ref);
    await expect(c.registerVersion(id, sha('a'), ref)).to.be.revertedWithCustomError(c, 'DuplicateHash');
  });

  it('verifies the correct hash and detects a modified one', async () => {
    const { c } = await setup();
    const id = docId('doc-1');
    await c.registerDocument(id, sha('original'), ref);
    expect(await c.verifyDocument(id, 1, sha('original'))).to.equal(true);
    expect(await c.verifyDocument(id, 1, sha('original-modified'))).to.equal(false);
    expect(await c.verifyDocument(id, 2, sha('original'))).to.equal(false);
    expect(await c.verifyDocument(docId('missing'), 1, sha('original'))).to.equal(false);
  });

  it('blocks unauthorized registration and owner-only functions', async () => {
    const { c, registrar, stranger } = await setup();
    const id = docId('doc-1');
    await expect(c.connect(stranger).registerDocument(id, sha('a'), ref)).to.be.revertedWithCustomError(c, 'NotRegistrar');
    await expect(c.connect(stranger).setRegistrar(stranger.address, true)).to.be.revertedWithCustomError(c, 'NotOwner');
    await c.setRegistrar(registrar.address, true);
    await expect(c.connect(registrar).registerDocument(id, sha('a'), ref)).to.emit(c, 'DocumentRegistered');
    await c.setRegistrar(registrar.address, false);
    await expect(c.connect(registrar).registerVersion(id, sha('b'), ref)).to.be.revertedWithCustomError(c, 'NotRegistrar');
  });

  it('rejects empty hashes and out-of-range versions', async () => {
    const { c } = await setup();
    const id = docId('doc-1');
    await expect(c.registerDocument(id, ethers.ZeroHash, ref)).to.be.revertedWithCustomError(c, 'EmptyHash');
    await c.registerDocument(id, sha('a'), ref);
    await expect(c.getVersion(id, 0)).to.be.revertedWithCustomError(c, 'VersionOutOfRange');
    await expect(c.getVersion(id, 5)).to.be.revertedWithCustomError(c, 'VersionOutOfRange');
  });
});
