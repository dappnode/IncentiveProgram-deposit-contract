const bre = require("hardhat");
const { ethers, upgrades } = require("hardhat");

async function main() {
  // compìle contracts
  await bre.run("compile");

  const IncentiveFactory = await ethers.getContractFactory("IncentiveDepositContract");
  const incentiveProxyAddress = "0x6C68322cf55f5f025F2aebd93a28761182d077c3";

  // Upgrade 
  const tx = await upgrades.upgradeProxy(incentiveProxyAddress, IncentiveFactory);

  console.log(tx.deployTransaction);
  console.log("upgrade succesfull");
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
