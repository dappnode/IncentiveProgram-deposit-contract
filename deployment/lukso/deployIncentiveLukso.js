const {ethers} = require("hardhat");
const path = require("path");

async function main() {
    const deployer = (await ethers.getSigners())[0];
    console.log("deploying with: ", deployer.address);

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
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
