const { ethers } = require('hardhat');
const path = require('path');

async function main() {
    const deployer = (await ethers.getSigners())[0];

    // xDai Address
    const sbcTokenAddress = "0x722fc4DAABFEaff81b97894fC623f91814a1BF68";
    const sbcDepositContractAddress = "0x6da1365c3baad9b6ccb76c2560523dbbbcc94cde";

    /*
        Deploy Dappnode Incentive deposit contract
    */
    console.log('\n#######################');
    console.log('##### Deployment Proof of Efficiency #####');
    console.log('#######################');
    console.log('sbcToken:', sbcTokenAddress);
    console.log('sbcDepositContract:', sbcDepositContractAddress);

    const IncentiveDepositContractFactory = await ethers.getContractFactory('IncentiveDepositContract')
    incentiveDepositContract = await upgrades.deployProxy(IncentiveDepositContractFactory, [sbcTokenAddress, sbcDepositContractAddress])
    await incentiveDepositContract.deployed();

    console.log('#######################\n');
    console.log('Dappnode Incentive contract deployed to:', incentiveDepositContract.address);


    console.log('\n#######################');
    console.log('#####    Checks    #####');
    console.log('#######################');
    console.log('sbcToken:', await incentiveDepositContract.sbcToken());
    console.log('sbcDepositContract:', await incentiveDepositContract.sbcDepositContract());
    console.log('DEPOSIT_AMOUNT:', await incentiveDepositContract.DEPOSIT_AMOUNT());
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});