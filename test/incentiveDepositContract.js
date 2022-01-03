const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

const depositAmount = ethers.utils.parseEther("32");

const deposit = {
  pubkey: '0x85e52247873439b180471ceb94ef9966c2cef1c194cc926e7d6494fecccbcdc076bcd751309f174dd8b7e21402c85ac0',
  withdrawal_credentials: '0x0100000000000000000000000ae055097c6d159879521c384f1d2123d1f195e6',
  signature: '0x869a92ea96afe7a08e19c0b89259c52d156f83b9af83d6e411f5f39ad857a06a3b9885d5f8d7ddb9371256fe181df4e011463e93b23af2653b501b9ebcfc32131ae7b8a1c815c6d8b2e7accb890f06f0a0bc4604050d658241ffb78220a2db58',
  deposit_data_root: '0xdcc623abcf86090d33c63845a83b13064e558ea9aa38d5db07d2dd412bebc9f0',
  value: depositAmount
}
const otherDeposit = {
  pubkey: '0xa9529f1f7ac7e6607ac605e2152053e3d3a8ce7c48308654d452f5cb8a1eb5e238c4b9e992caf8ec6923994b07e4d236',
  withdrawal_credentials: '0x0100000000000000000000000ae055097c6d159879521c384f1d2123d1f195e6',
  signature: '0xb4c4fa967494ad174355ea8da67ddd73e49f0936ffbf95f4096031cd00a44a45a89d12f17c58b80de6db465581635c5412876fb12ed882eaa1f744cf5c71f493d8a2c5eee30d7181f8e70a5ebd9b43d2015e1dfbc1b466e307faf850601930f1',
  deposit_data_root: '0xef472710da79583c8f513e816e178a746afe060a2ed5b0032696d898909d1d83',
  value: depositAmount
}
const depositWC1 = {
  pubkey: '0x95214485553be079e2723c04f8d18c110adaeb56c5e64b97f5df59862a0188c301686cdd55e31aa733a0988e9cfe4de4',
  withdrawal_credentials: '0x0100000000000000000000000ae055097c6d159879521c384f1d2123d1f195e6',
  signature: '0xaf388083b3377002f9bda48fb435a6d2bb9e06717494ed3e5e7d00711fbb0028d460e9aa3321a90c5705d7a9ccb5375b125d0394858650fc29c03880654f4c592301d7dbf0db6db2369c623e8734e291d0b0a81030c7c9a6df99b08d2172190f',
  deposit_data_root: '0xcfe78c9aff7cbb24c317b05b8c6e29b93003f8271944c37c7d17e5490ee5d494',
  value: depositAmount
}
const depositWC2 = {
  pubkey: '0x95214485553be079e2723c04f8d18c110adaeb56c5e64b97f5df59862a0188c301686cdd55e31aa733a0988e9cfe4de4',
  withdrawal_credentials: '0x010000000000000000000000c00e94cb662c3520282e6f5717214004a7f26888',
  signature: '0xa0b87d3b9a1373d8097405bfb6f6ee4a237dfcdff6cf8be37932237504c80949409f22666900b3d5518b5f3a42d790960bbabec0221a73857d928a45c2f9913e6dc1f6b6b72a90dd4c8c7320913bedde1b9b6e33b20cd7fa18f5664faf162be4',
  deposit_data_root: '0x6f776e2ebf8eed5b75896b63ecec56cc31e3ab637530a9c4d041d82a0cf46a7f',
  value: depositAmount
}
const invalidDataRoot = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

describe("IncentiveDepositContract", function () {
  let deployer;

  let SBCTokenContract;
  let SBCDepositContract;

  beforeEach("Deploy contract", async () => {
    // load signers
    const signers = await ethers.getSigners();
    deployer = signers[0];

    // Gnosis deposit contact deployment without wrapper, deployer will be the admin of the SCB token
    const SBCDepositContractProxyFactory = await ethers.getContractFactory('SBCDepositContractProxy')
    const SBCDepositContractFactory = await ethers.getContractFactory('SBCDepositContract')
    const SBCTokenProxyFactory = await ethers.getContractFactory('SBCTokenProxy')
    const SBCTokenFactory = await ethers.getContractFactory('SBCToken')

    SBCTokenProxyContract = await SBCTokenProxyFactory.deploy(deployer.address, 'SBC Token', 'SBCT')
    SBCTokenContract = await SBCTokenFactory.attach(SBCTokenProxyContract.address)

    SBCDepositContractProxy = await SBCDepositContractProxyFactory.deploy(deployer.address, SBCTokenContract.address)
    SBCDepositContract = await SBCDepositContractFactory.attach(SBCDepositContractProxy.address)


    // Dappnode incentive deposit contract
    const IncentiveDepositContractFactory = await ethers.getContractFactory('IncentiveDepositContract')
    incentiveDepositContract = await IncentiveDepositContractFactory.deploy()
    await incentiveDepositContract.initialize(SBCTokenContract.address, SBCDepositContract.address)


    // Set minter to the deployment address
    await SBCTokenContract.setMinter(deployer.address)
  });

  it("should check the initialized variables", async () => {
    expect(await incentiveDepositContract.sbcToken()).to.be.equal(SBCTokenContract.address);
    expect(await incentiveDepositContract.sbcDepositContract()).to.be.equal(SBCDepositContract.address);
    expect(await incentiveDepositContract.DEPOSIT_AMOUNT()).to.be.equal(depositAmount);
  });

  it("should be able to make a deposit using transferAndCall", async () => {
    const data = ethers.utils.hexConcat([deposit.withdrawal_credentials, deposit.pubkey, deposit.signature, deposit.deposit_data_root])
    const invalidData = ethers.utils.hexConcat([deposit.withdrawal_credentials, deposit.pubkey, deposit.signature, invalidDataRoot])

    // should revert because address do not have tokens
    await expect(SBCTokenContract.transferAndCall(SBCDepositContract.address, deposit.value, data))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance")

    // mint tokens for the deployer
    await SBCTokenContract.mint(deployer.address, depositAmount)
    expect(await SBCTokenContract.balanceOf(deployer.address)).to.be.equal(depositAmount);

    // should revert for invalid data
    await expect(SBCTokenContract.transferAndCall(SBCDepositContract.address, deposit.value, invalidData))
      .to.be.revertedWith("DepositContract: reconstructed DepositData does not match supplied deposit_data_root")

    // should perform correctly a deposit
    await SBCTokenContract.transferAndCall(SBCDepositContract.address, deposit.value, data)
    expect(await SBCDepositContract.get_deposit_count()).to.be.equal('0x0100000000000000')
    expect(await SBCDepositContract.get_deposit_root()).to.be.equal('0x4e84f51e6b1cf47fd51d021635d791b9c99fe915990061a5a10390b9140e3592')

    expect(await SBCTokenContract.balanceOf(SBCDepositContract.address)).to.be.equal(depositAmount)
    expect(await SBCTokenContract.balanceOf(deployer.address)).to.be.equal(0);
  });

  it("should be able to make a deposit using claimIncentive", async () => {
    const data = ethers.utils.hexConcat([deposit.withdrawal_credentials, deposit.pubkey, deposit.signature, deposit.deposit_data_root])
    const invalidData = ethers.utils.hexConcat([deposit.withdrawal_credentials, deposit.pubkey, deposit.signature, invalidDataRoot])

    // should revert because contract do not have tokens
    await expect(incentiveDepositContract.claimIncentive(data))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance")

    // mint tokens for the dappnode deposit contract
    const initialTokens = depositAmount.mul(4);
    await SBCTokenContract.mint(incentiveDepositContract.address, initialTokens)
    expect(await SBCTokenContract.balanceOf(incentiveDepositContract.address)).to.be.equal(initialTokens);

    // should revert for invalid data
    await expect(incentiveDepositContract.claimIncentive(invalidData))
      .to.be.revertedWith("DepositContract: reconstructed DepositData does not match supplied deposit_data_root")

    // should perform correctly a deposit
    await incentiveDepositContract.claimIncentive(data)
    expect(await SBCDepositContract.get_deposit_count()).to.be.equal('0x0100000000000000')
    expect(await SBCDepositContract.get_deposit_root()).to.be.equal('0x4e84f51e6b1cf47fd51d021635d791b9c99fe915990061a5a10390b9140e3592')

    expect(await SBCTokenContract.balanceOf(SBCDepositContract.address)).to.be.equal(depositAmount)
    expect(await SBCTokenContract.balanceOf(incentiveDepositContract.address)).to.be.equal(initialTokens.sub(depositAmount));
  });
});