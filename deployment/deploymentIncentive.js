const { ethers } = require('hardhat');
const path = require('path');

async function main() {
    const deployer = (await ethers.getSigners())[0];

    const sbcTokenAddress = "0x0000000000000000000000000000000000000001";
    const sbcDepositContractAddress = "0x0000000000000000000000000000000000000002";

    /*
        Deployment Dappnode Incentive contract
    */
    console.log('\n#######################');
    console.log('##### Deployment Proof of Efficiency #####');
    console.log('#######################');
    console.log('sbcToken:', sbcTokenAddress);
    console.log('sbcDepositContract:', sbcDepositContractAddress);

    const IncentiveDepositContractFactory = await ethers.getContractFactory('IncentiveDepositContract')
    incentiveDepositContract = await IncentiveDepositContractFactory.deploy();
    await incentiveDepositContract.deployed();
    await incentiveDepositContract.initialize(sbcTokenAddress, sbcDepositContractAddress)

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
