const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const IncentiveFactory = await ethers.getContractFactory("IncentiveDepositContract");
  const incentiveProxyAddress = "0x6C68322cf55f5f025F2aebd93a28761182d077c3";
  const IncentiveContract = await IncentiveFactory.attach(incentiveProxyAddress);

  // Set token distro
  const tokenDistroAddress = "0x70b2219f8099f63e4259d9ec331b8efb433cf3d2";
  await IncentiveContract.setTokenDistro(tokenDistroAddress)
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
