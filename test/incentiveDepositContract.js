const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("IncentiveDepositContract", function () {
  let deployer;

  let SBCTokenContract;
  let SBCDepositContract;

  let token;
  let tokenDistro;

  const incentiveDurationDefault = 60 * 60 * 24 * 30; // 30 days
  const validatorNumDefault = 1;
  const depositAmount = ethers.utils.parseEther("32");
  const amountNode = ethers.utils.parseEther("20000000");
  const amountAirdrop = ethers.utils.parseEther("500");

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
    value: '32000000000000000000'
  }

  const invalidDataRoot = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

  beforeEach("Deploy contract", async () => {
    // load signers
    const signers = await ethers.getSigners();
    deployer = signers[0];

    beneficiary1 = signers[1];
    beneficiary2 = signers[2];
    beneficiary3 = signers[3];
    beneficiary4 = signers[4];

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
    await incentiveDepositContract.initialize(SBCTokenContract.address, SBCDepositContract.address, validatorNumDefault, incentiveDurationDefault)


    // Set minter to the deployment address
    await SBCTokenContract.setMinter(deployer.address)

    // deploy Node token 
    const tokenFactory = await ethers.getContractFactory("NODE");
    token = await tokenFactory.deploy(deployer.address);
    await token.deployed();
    await token.mint(deployer.address, amountNode);

    // deploy Token distro
    const TokenDistroFactory = await ethers.getContractFactory("TokenDistroMock");

    const startTime = (await ethers.provider.getBlock()).timestamp;
    const startToCliff = 180 * (3600 * 24);
    const startToEnd = 730 * (3600 * 24);
    const initialPercentage = 0;

    tokenDistro = await TokenDistroFactory.deploy(
      amountNode,
      startTime,
      startToCliff,
      startToEnd,
      initialPercentage,
      token.address,
      false
    );


  });

  it("should check the initialized variables", async () => {
    expect(await incentiveDepositContract.sbcToken()).to.be.equal(SBCTokenContract.address);
    expect(await incentiveDepositContract.sbcDepositContract()).to.be.equal(SBCDepositContract.address);
    expect(await incentiveDepositContract.validatorNum()).to.be.equal(validatorNumDefault);
    expect(await incentiveDepositContract.DEPOSIT_AMOUNT()).to.be.equal(depositAmount);
    expect(await incentiveDepositContract.incentiveDuration()).to.be.equal(incentiveDurationDefault);
    expect(await incentiveDepositContract.tokenDistro()).to.be.equal(ethers.constants.AddressZero);
    expect(await incentiveDepositContract.NODE_AIRDROP_AMOUNT()).to.be.equal(amountAirdrop);
  });

  it("should be able to add and cancel incentives", async () => {
    const beneficiaryArray = [beneficiary1.address, beneficiary2.address, beneficiary3.address];

    // Check beneficiary data is empty
    for (let i = 0; i < beneficiaryArray.length; i++) {
      const currentAddress = beneficiaryArray[i];
      const incentiveData = await incentiveDepositContract.addressToIncentive(currentAddress);
      expect(incentiveData.isClaimed).to.be.equal(false);
      expect(incentiveData.endTime).to.be.equal(0);
    }

    // Add beneficiarys to the incentive program
    await expect(incentiveDepositContract.addBeneficiaries(beneficiaryArray))
      .to.emit(incentiveDepositContract, "NewIncentive");

    const timestamp = (await ethers.provider.getBlock()).timestamp
    const endIncentiveTime = timestamp + incentiveDurationDefault;

    // Check beneficiary data is fullfilled
    for (let i = 0; i < beneficiaryArray.length; i++) {
      const currentAddress = beneficiaryArray[i];
      const incentiveData = await incentiveDepositContract.addressToIncentive(currentAddress);
      expect(incentiveData.isClaimed).to.be.equal(false);
      expect(incentiveData.endTime).to.be.equal(endIncentiveTime);
    };

    // Cancel an incentive
    const cancelAddress = [beneficiary1.address, beneficiary2.address];
    await expect(incentiveDepositContract.cancelIncentive(cancelAddress))
      .to.emit(incentiveDepositContract, "CancelIncentive");

    // Check beneficiary data is fullfilled
    for (let i = 0; i < cancelAddress.length; i++) {
      const currentAddress = cancelAddress[i];
      const incentiveData = await incentiveDepositContract.addressToIncentive(currentAddress);
      expect(incentiveData.isClaimed).to.be.equal(true);
      expect(incentiveData.endTime).to.be.equal(endIncentiveTime);
    };

    // should revert because the incentive is canceled
    const data = ethers.utils.hexConcat([deposit.withdrawal_credentials, deposit.pubkey, deposit.signature, deposit.deposit_data_root])
    await expect(incentiveDepositContract.connect(beneficiary1).claimIncentive(data))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incentive already claimed");

    await expect(incentiveDepositContract.connect(beneficiary2).claimIncentive(data))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incentive already claimed");

    // advance blocks until the enc of the incentive
    await ethers.provider.send("evm_increaseTime", [endIncentiveTime + 1])
    await ethers.provider.send("evm_mine")

    const incentiveDataB3 = await incentiveDepositContract.addressToIncentive(beneficiary3.address);
    expect(incentiveDataB3.isClaimed).to.be.equal(false);
    expect(incentiveDataB3.endTime).to.be.equal(endIncentiveTime);

    // should revert because the incentive is timeout
    await expect(incentiveDepositContract.connect(beneficiary3).claimIncentive(data))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incentive timeout");
  });

  it("should be able to renew incentives", async () => {
    const beneficiaryArray = [beneficiary1.address, beneficiary2.address, beneficiary3.address];

    // Check beneficiary data is empty
    for (let i = 0; i < beneficiaryArray.length; i++) {
      const currentAddress = beneficiaryArray[i];
      const incentiveData = await incentiveDepositContract.addressToIncentive(currentAddress);
      expect(incentiveData.isClaimed).to.be.equal(false);
      expect(incentiveData.endTime).to.be.equal(0);
    }

    // Try to renew beneficiarys that are not added to the incentive program
    await expect(incentiveDepositContract.renewBeneficiaries(beneficiaryArray))
      .to.emit(incentiveDepositContract, "RenewIncentive");

    // Does not change anything
    for (let i = 0; i < beneficiaryArray.length; i++) {
      const currentAddress = beneficiaryArray[i];
      const incentiveData = await incentiveDepositContract.addressToIncentive(currentAddress);
      expect(incentiveData.isClaimed).to.be.equal(false);
      expect(incentiveData.endTime).to.be.equal(0);
    }

    // Cancel an incentive
    const cancelAddress = [beneficiary1.address];
    await expect(incentiveDepositContract.cancelIncentive(cancelAddress))
      .to.emit(incentiveDepositContract, "CancelIncentive");

    // Add beneficiarys to the incentive program
    await expect(incentiveDepositContract.addBeneficiaries(beneficiaryArray))
      .to.emit(incentiveDepositContract, "NewIncentive");

    const timestamp = (await ethers.provider.getBlock()).timestamp
    const endIncentiveTime = timestamp + incentiveDurationDefault;

    // Check beneficiary data is fullfilled and the cancel address is not udpated
    for (let i = 0; i < beneficiaryArray.length; i++) {
      const currentAddress = beneficiaryArray[i];
      const incentiveData = await incentiveDepositContract.addressToIncentive(currentAddress);
      if (cancelAddress.includes(currentAddress)) {
        expect(incentiveData.isClaimed).to.be.equal(true);
        expect(incentiveData.endTime).to.be.equal(0);
      } else {
        expect(incentiveData.isClaimed).to.be.equal(false);
        expect(incentiveData.endTime).to.be.equal(endIncentiveTime);
      }
    }

    // Try to extend the duration using addBeneficiaries
    await expect(incentiveDepositContract.addBeneficiaries(beneficiaryArray))
      .to.emit(incentiveDepositContract, "NewIncentive");

    // Nothing has changed
    for (let i = 0; i < beneficiaryArray.length; i++) {
      const currentAddress = beneficiaryArray[i];
      const incentiveData = await incentiveDepositContract.addressToIncentive(currentAddress);
      if (cancelAddress.includes(currentAddress)) {
        expect(incentiveData.isClaimed).to.be.equal(true);
        expect(incentiveData.endTime).to.be.equal(0);
      } else {
        expect(incentiveData.isClaimed).to.be.equal(false);
        expect(incentiveData.endTime).to.be.equal(endIncentiveTime);
      }
    }

    // Try to extend the duration using renewBeneficiaries
    await expect(incentiveDepositContract.renewBeneficiaries(beneficiaryArray))
      .to.emit(incentiveDepositContract, "RenewIncentive");

    const timestamp2 = (await ethers.provider.getBlock()).timestamp
    const endIncentiveTime2 = timestamp2 + incentiveDurationDefault;
    expect(endIncentiveTime2).to.be.greaterThan(endIncentiveTime);

    // Check beneficiary data is updated and the cancel address is not
    for (let i = 0; i < beneficiaryArray.length; i++) {
      const currentAddress = beneficiaryArray[i];
      const incentiveData = await incentiveDepositContract.addressToIncentive(currentAddress);
      if (cancelAddress.includes(currentAddress)) {
        expect(incentiveData.isClaimed).to.be.equal(true);
        expect(incentiveData.endTime).to.be.equal(0);
      } else {
        expect(incentiveData.isClaimed).to.be.equal(false);
        expect(incentiveData.endTime).to.be.equal(endIncentiveTime2);
      }
    }
  });

  it("should be able to update the validator number", async () => {
    expect(await incentiveDepositContract.validatorNum()).to.be.equal(validatorNumDefault);

    // update validator number
    const newValidatorNum = 4;
    await expect(incentiveDepositContract.setValidatorNum(newValidatorNum))
      .to.emit(incentiveDepositContract, "SetValidatorNum")
      .withArgs(newValidatorNum);

    expect(await incentiveDepositContract.validatorNum()).to.be.equal(newValidatorNum);
  });

  it("should be able to update the incentive duration", async () => {
    expect(await incentiveDepositContract.incentiveDuration()).to.be.equal(incentiveDurationDefault);

    // update incentive duration
    const newIncentiveDuration = 4;
    await expect(incentiveDepositContract.setIncentiveDuration(newIncentiveDuration))
      .to.emit(incentiveDepositContract, "SetIncentiveDuration")
      .withArgs(newIncentiveDuration);

    expect(await incentiveDepositContract.incentiveDuration()).to.be.equal(newIncentiveDuration);
  });

  it("should be able to make a deposit using transferAndCall", async () => {
    // This test is useffull for check tha the deposit data is well constructed and the test deployment works
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


  it("should be able to claim incentive", async () => {
    const data = ethers.utils.hexConcat([deposit.withdrawal_credentials, deposit.pubkey, deposit.signature, deposit.deposit_data_root])
    const invalidData = ethers.utils.hexConcat([deposit.withdrawal_credentials, deposit.pubkey, deposit.signature, invalidDataRoot])

    // should revert because that address do not have an incentive
    await expect(incentiveDepositContract.claimIncentive(data))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incentive timeout")

    // add deployer address to the incentive program
    await expect(incentiveDepositContract.addBeneficiaries([deployer.address]))
      .to.emit(incentiveDepositContract, "NewIncentive");

    // Check the incentive data
    const currentTimestamp = (await ethers.provider.getBlock()).timestamp
    const endIncentiveTime = currentTimestamp + incentiveDurationDefault;
    const incentiveData = await incentiveDepositContract.addressToIncentive(deployer.address);
    expect(incentiveData.isClaimed).to.be.equal(false);
    expect(incentiveData.endTime).to.be.equal(endIncentiveTime);

    // should revert because contract do not have tokens
    await expect(incentiveDepositContract.claimIncentive(data))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance")

    // mint tokens for the dappnode incentive deposit contract
    const initialTokens = depositAmount.mul(4);
    await SBCTokenContract.mint(incentiveDepositContract.address, initialTokens)
    expect(await SBCTokenContract.balanceOf(incentiveDepositContract.address)).to.be.equal(initialTokens);

    // should revert for invalid data
    await expect(incentiveDepositContract.claimIncentive(invalidData))
      .to.be.revertedWith("DepositContract: reconstructed DepositData does not match supplied deposit_data_root")

    // Should add because tokenDistro is not set
    await expect(incentiveDepositContract.claimIncentive(data))
      .to.be.revertedWith("function call to a non-contract account")

    // set tokenDistro
    expect(await incentiveDepositContract.tokenDistro()).to.be.equal(ethers.constants.AddressZero);
    await incentiveDepositContract.setTokenDistro(tokenDistro.address)
    expect(await incentiveDepositContract.tokenDistro()).to.be.equal(tokenDistro.address);

    // Should add because contract does not have distributor rights
    await expect(incentiveDepositContract.claimIncentive(data))
      .to.be.revertedWith("TokenDistro::allocate: ONLY_DISTRIBUTOR_ROLE")

    // Transfer tokens, assign role and assign tokens
    await token.transfer(tokenDistro.address, amountNode)
    await tokenDistro.grantRole(await tokenDistro.DISTRIBUTOR_ROLE(), incentiveDepositContract.address)
    await tokenDistro.assign(incentiveDepositContract.address, amountNode)

    // should perform correctly a deposit
    await expect(incentiveDepositContract.claimIncentive(data))
      .to.emit(incentiveDepositContract, "ClaimedIncentive")
      .withArgs(deployer.address)
      .to.emit(tokenDistro, "Allocate")
      .withArgs(incentiveDepositContract.address, deployer.address, amountAirdrop)

    // Check into the deposit contract that everything goes ok, this values are from the gnosis deposit contract test
    expect(await SBCDepositContract.get_deposit_count()).to.be.equal('0x0100000000000000')
    expect(await SBCDepositContract.get_deposit_root()).to.be.equal('0x4e84f51e6b1cf47fd51d021635d791b9c99fe915990061a5a10390b9140e3592')

    // should revert because the incentive is already claimed
    await expect(incentiveDepositContract.claimIncentive(data))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incentive already claimed")

    // check balances
    expect(await SBCTokenContract.balanceOf(SBCDepositContract.address)).to.be.equal(depositAmount)
    expect(await SBCTokenContract.balanceOf(incentiveDepositContract.address)).to.be.equal(initialTokens.sub(depositAmount));

    // check incentive data
    const incentiveDataAfter = await incentiveDepositContract.addressToIncentive(deployer.address);
    expect(incentiveDataAfter.isClaimed).to.be.equal(true);
    expect(incentiveDataAfter.endTime).to.be.equal(endIncentiveTime);
  });

  it("should be able to claim tokens", async () => {
    const incentiveDepositAddress = incentiveDepositContract.address;

    // mint tokens to the deposit contract
    const mintTokens = ethers.utils.parseEther("10");
    await SBCTokenContract.mint(incentiveDepositAddress, mintTokens)

    expect(await SBCTokenContract.balanceOf(incentiveDepositAddress)).to.be.equal(mintTokens);

    // claim tokens from the deposit contract
    await incentiveDepositContract.claimTokens(SBCTokenContract.address, deployer.address);

    // check balances
    expect(await SBCTokenContract.balanceOf(SBCDepositContract.address)).to.be.equal(0)
    expect(await SBCTokenContract.balanceOf(deployer.address)).to.be.equal(mintTokens);
  });


  it("should be able to claim incentive with more than one validator", async () => {
    const dataDeposit1 = ethers.utils.hexConcat([deposit.pubkey, deposit.signature, deposit.deposit_data_root])
    const dataDeposit2 = ethers.utils.hexConcat([otherDeposit.pubkey, otherDeposit.signature, otherDeposit.deposit_data_root])
    const fullData = ethers.utils.hexConcat([deposit.withdrawal_credentials, dataDeposit1, dataDeposit2])

    const invalidData = ethers.utils.hexConcat([deposit.pubkey, deposit.signature, invalidDataRoot])
    const fullInvalidData = ethers.utils.hexConcat([deposit.withdrawal_credentials, invalidData, dataDeposit2])
    const fullInvalidDataNoCredentials = ethers.utils.hexConcat([dataDeposit1, dataDeposit2])

    // add deployer address to the incentive program
    await expect(incentiveDepositContract.addBeneficiaries([deployer.address]))
      .to.emit(incentiveDepositContract, "NewIncentive");

    // mint tokens for the dappnode incentive deposit contract
    const initialTokens = depositAmount.mul(4);
    await SBCTokenContract.mint(incentiveDepositContract.address, initialTokens)
    expect(await SBCTokenContract.balanceOf(incentiveDepositContract.address)).to.be.equal(initialTokens);

    // set validator num to 2
    const newValidatorNum = 2;
    await expect(incentiveDepositContract.setValidatorNum(newValidatorNum))
      .to.emit(incentiveDepositContract, "SetValidatorNum")
      .withArgs(newValidatorNum)


    // setup tokenDistro
    await incentiveDepositContract.setTokenDistro(tokenDistro.address)
    await token.transfer(tokenDistro.address, amountNode)
    await tokenDistro.grantRole(await tokenDistro.DISTRIBUTOR_ROLE(), incentiveDepositContract.address)
    await tokenDistro.assign(incentiveDepositContract.address, amountNode)

    // should revert because deposit data length does not match with the validatorNum
    await expect(incentiveDepositContract.claimIncentive(dataDeposit1))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incorrect deposit data length")

    await expect(incentiveDepositContract.claimIncentive(dataDeposit2))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incorrect deposit data length")

    await expect(incentiveDepositContract.claimIncentive(fullInvalidDataNoCredentials))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incorrect deposit data length")

    // should revert because invalid data
    await expect(incentiveDepositContract.claimIncentive(fullInvalidData))
      .to.be.revertedWith("DepositContract: reconstructed DepositData does not match supplied deposit_data_root")

    // should perform correctly a deposit of 2 validators
    await expect(incentiveDepositContract.claimIncentive(fullData))
      .to.emit(incentiveDepositContract, "ClaimedIncentive")
      .withArgs(deployer.address);

    // Check into the deposit contract that everything goes ok, this values are from the gnosis deposit contract test batch
    expect(await SBCDepositContract.get_deposit_count()).to.be.equal('0x0200000000000000')
    expect(await SBCDepositContract.get_deposit_root()).to.be.equal('0x332ba4af23d9afe9a5ac1c80604c72a995686b8decfdae91f69798bc93813257')

    // should revert because the incentive is already claimed
    await expect(incentiveDepositContract.claimIncentive(fullData))
      .to.be.revertedWith("IncentiveDepositContract::claimIncentive:: incentive already claimed")

    // check balances
    expect(await SBCTokenContract.balanceOf(SBCDepositContract.address)).to.be.equal(depositAmount.mul(newValidatorNum))
    expect(await SBCTokenContract.balanceOf(incentiveDepositContract.address)).to.be.equal(initialTokens.sub(depositAmount.mul(newValidatorNum)));

    // check incentive data
    const incentiveDataAfter = await incentiveDepositContract.addressToIncentive(deployer.address);
    expect(incentiveDataAfter.isClaimed).to.be.equal(true);
  });

  it("should be able to claim incentive with 4 validators", async () => {
    const dataDeposit1 = ethers.utils.hexConcat([deposit.pubkey, deposit.signature, deposit.deposit_data_root])
    const fullData = ethers.utils.hexConcat([deposit.withdrawal_credentials, dataDeposit1, dataDeposit1, dataDeposit1, dataDeposit1])

    // add deployer address to the incentive program
    await expect(incentiveDepositContract.addBeneficiaries([deployer.address]))
      .to.emit(incentiveDepositContract, "NewIncentive");

    // mint tokens for the dappnode incentive deposit contract
    const initialTokens = depositAmount.mul(4);
    await SBCTokenContract.mint(incentiveDepositContract.address, initialTokens)
    expect(await SBCTokenContract.balanceOf(incentiveDepositContract.address)).to.be.equal(initialTokens);

    // setup tokenDistro
    await incentiveDepositContract.setTokenDistro(tokenDistro.address)
    await token.transfer(tokenDistro.address, amountNode)
    await tokenDistro.grantRole(await tokenDistro.DISTRIBUTOR_ROLE(), incentiveDepositContract.address)
    await tokenDistro.assign(incentiveDepositContract.address, amountNode)

    // set validator num to 4
    const newValidatorNum = 4;
    await expect(incentiveDepositContract.setValidatorNum(newValidatorNum))
      .to.emit(incentiveDepositContract, "SetValidatorNum")
      .withArgs(newValidatorNum)

    // should perform correctly a deposit of 4 validators
    await expect(incentiveDepositContract.claimIncentive(fullData))
      .to.emit(incentiveDepositContract, "ClaimedIncentive")
      .withArgs(deployer.address);

    // check balances
    expect(await SBCTokenContract.balanceOf(SBCDepositContract.address)).to.be.equal(initialTokens)
    expect(await SBCTokenContract.balanceOf(incentiveDepositContract.address)).to.be.equal(0);

    // check incentive data
    const incentiveDataAfter = await incentiveDepositContract.addressToIncentive(deployer.address);
    expect(incentiveDataAfter.isClaimed).to.be.equal(true);
  });

  it("should be able to allocate many", async () => {
    // setup tokenDistro
    await incentiveDepositContract.setTokenDistro(tokenDistro.address)
    await token.transfer(tokenDistro.address, amountNode)
    await tokenDistro.grantRole(await tokenDistro.DISTRIBUTOR_ROLE(), incentiveDepositContract.address)
    await tokenDistro.assign(incentiveDepositContract.address, amountNode)


    let amountRecipient1 = amountNode.div(2);
    let amountRecipient2 = amountRecipient1.div(2);
    let amountRecipient3 = amountRecipient2.div(2);
    let amountRecipient4 = amountRecipient3.div(2);

    const addresses = [beneficiary1.address, beneficiary2.address, beneficiary3.address, beneficiary4.address]
    const amounts = [amountRecipient1, amountRecipient2, amountRecipient3, amountRecipient4]

    await expect(incentiveDepositContract.allocateMany(addresses, amounts))
      .to.emit(tokenDistro, "Allocate")
      .withArgs(incentiveDepositContract.address, beneficiary1.address, amountRecipient1)
      .to.emit(tokenDistro, "Allocate")
      .withArgs(incentiveDepositContract.address, beneficiary2.address, amountRecipient2)
      .to.emit(tokenDistro, "Allocate")
      .withArgs(incentiveDepositContract.address, beneficiary3.address, amountRecipient3)
      .to.emit(tokenDistro, "Allocate")
      .withArgs(incentiveDepositContract.address, beneficiary4.address, amountRecipient4)
  });
});