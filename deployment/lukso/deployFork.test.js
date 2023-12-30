const {ethers, upgrades} = require("hardhat");
const path = require("path");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const {expect} = require("chai");

async function main() {
    const deployer = (await ethers.getSigners())[0];
    console.log("deploying with: ", deployer.address);

    // hard fork
    const rpc = "https://rpc.mainnet.lukso.network";
    await helpers.reset(rpc);
    await helpers.setBalance(deployer.address, 100n ** 18n);

    // xDai Address
    const validatorNumDefault = 4;
    const incentiveDurationDefault = 60 * 60 * 24 * 30; // 30 days

    /*
        Deploy Dappnode Incentive deposit contract
    */
    console.log("\n#######################");
    console.log("##### Deployment Incentive Despoit Contract #####");
    console.log("#######################");
    console.log("validatorNum:", validatorNumDefault);
    console.log("incentiveDuration:", incentiveDurationDefault);

    const IncentiveDepositContractFactory = await ethers.getContractFactory("IncentiveLuksoDepositContract");
    incentiveDepositContract = await upgrades.deployProxy(IncentiveDepositContractFactory, [
        validatorNumDefault,
        incentiveDurationDefault,
    ]);
    await incentiveDepositContract.deployed();

    console.log("#######################\n");
    console.log("Dappnode Incentive contract deployed to:", incentiveDepositContract.address);

    console.log("\n#######################");
    console.log("#####    Checks    #####");
    console.log("#######################");
    console.log("validatorNum:", await incentiveDepositContract.validatorNum());
    console.log("incentiveDuration:", await incentiveDepositContract.incentiveDuration());

    expect(await incentiveDepositContract.owner()).to.be.equal(deployer.address);

    // Try claim incentive
    const testDeposit = {
        pubkey: "0x85e52247873439b180471ceb94ef9966c2cef1c194cc926e7d6494fecccbcdc076bcd751309f174dd8b7e21402c85ac0",
        withdrawal_credentials: "0x0100000000000000000000000ae055097c6d159879521c384f1d2123d1f195e6",
        signature:
            "0x869a92ea96afe7a08e19c0b89259c52d156f83b9af83d6e411f5f39ad857a06a3b9885d5f8d7ddb9371256fe181df4e011463e93b23af2653b501b9ebcfc32131ae7b8a1c815c6d8b2e7accb890f06f0a0bc4604050d658241ffb78220a2db58",
        deposit_data_root: "0xdcc623abcf86090d33c63845a83b13064e558ea9aa38d5db07d2dd412bebc9f0",
        value: ethers.utils.parseEther("32"),
    };

    const dataDeposit1 = ethers.utils.hexConcat([
        testDeposit.pubkey,
        testDeposit.signature,
        testDeposit.deposit_data_root,
    ]);
    const fullData = ethers.utils.hexConcat([
        testDeposit.withdrawal_credentials,
        dataDeposit1,
        dataDeposit1,
        dataDeposit1,
        dataDeposit1,
    ]);

    // add deployer address to the incentive program
    await expect(incentiveDepositContract.addBeneficiaries([deployer.address])).to.emit(
        incentiveDepositContract,
        "NewIncentive"
    );

    await deployer.sendTransaction({to: incentiveDepositContract.address, value: ethers.utils.parseEther("128")});

    const LUKSO_DEPOSIT_CONTRACT = "0xCAfe00000000000000000000000000000000CAfe";

    const initialLuksoDepositBalance = await ethers.provider.getBalance(LUKSO_DEPOSIT_CONTRACT);

    console.log(await ethers.provider.getBalance(incentiveDepositContract.address));

    // should perform correctly a deposit of 4 validators
    await expect(incentiveDepositContract.claimIncentive(fullData))
        .to.emit(incentiveDepositContract, "ClaimedIncentive")
        .withArgs(deployer.address);

    // check balances
    expect(await ethers.provider.getBalance(incentiveDepositContract.address)).to.be.equal(0);
    expect(await ethers.provider.getBalance(LUKSO_DEPOSIT_CONTRACT)).to.be.equal(
        initialLuksoDepositBalance.add(ethers.utils.parseEther("128"))
    );

    // check incentive data
    const incentiveDataAfter = await incentiveDepositContract.addressToIncentive(deployer.address);
    expect(incentiveDataAfter.isClaimed).to.be.equal(true);

    // check claim ether
    await deployer.sendTransaction({to: incentiveDepositContract.address, value: ethers.utils.parseEther("100")});

    const receiver = (await ethers.getSigners())[1];
    const receiverBalance = await ethers.provider.getBalance(receiver.address);
    expect(await ethers.provider.getBalance(incentiveDepositContract.address)).to.be.equal(
        ethers.utils.parseEther("100")
    );

    await incentiveDepositContract.claimTokens(ethers.constants.AddressZero, receiver.address);
    expect(await ethers.provider.getBalance(incentiveDepositContract.address)).to.be.equal(0);
    expect(await ethers.provider.getBalance(receiver.address)).to.be.equal(
        receiverBalance.add(ethers.utils.parseEther("100"))
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
