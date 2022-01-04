const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("IncentiveDepositContract", function () {
  let deployer;

  let SBCTokenContract;
  let SBCDepositContract;

  const validatorNum = 1;
  const depositAmount = ethers.utils.parseEther("32");

  const deposit = {
    pubkey: '0x85e52247873439b180471ceb94ef9966c2cef1c194cc926e7d6494fecccbcdc076bcd751309f174dd8b7e21402c85ac0',
    withdrawal_credentials: '0x0100000000000000000000000ae055097c6d159879521c384f1d2123d1f195e6',
    signature: '0x869a92ea96afe7a08e19c0b89259c52d156f83b9af83d6e411f5f39ad857a06a3b9885d5f8d7ddb9371256fe181df4e011463e93b23af2653b501b9ebcfc32131ae7b8a1c815c6d8b2e7accb890f06f0a0bc4604050d658241ffb78220a2db58',
    deposit_data_root: '0xdcc623abcf86090d33c63845a83b13064e558ea9aa38d5db07d2dd412bebc9f0',
    value: depositAmount
  }

  const invalidDataRoot = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

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
    await incentiveDepositContract.initialize(SBCTokenContract.address, SBCDepositContract.address, validatorNum)


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

    // should revert because that address do not have an incentive
    await expect(incentiveDepositContract.claimIncentive(data))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incentive timeout")

    // add incentive to the deployer address
    await incentiveDepositContract.addNewIncentive([deployer.address]);

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

    // should revert because the incentive is already claimed
    await expect(incentiveDepositContract.claimIncentive(data))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incentive already claimed")

    expect(await SBCTokenContract.balanceOf(SBCDepositContract.address)).to.be.equal(depositAmount)
    expect(await SBCTokenContract.balanceOf(incentiveDepositContract.address)).to.be.equal(initialTokens.sub(depositAmount));
  });
});