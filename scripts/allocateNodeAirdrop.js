const hre = require("hardhat");
const { ethers } = require("hardhat");

const allocationsAirdrop = require("./allocationsAirdrop.json");

async function main() {
  const IncentiveFactory = await ethers.getContractFactory("IncentiveDepositContract");
  const incentiveProxyAddress = "0x6C68322cf55f5f025F2aebd93a28761182d077c3";
  const IncentiveContract = await IncentiveFactory.attach(incentiveProxyAddress);

  // Send airdrop
  const amountAirdrop = ethers.utils.parseEther("500");

  for (let i = 0; i < allocationsAirdrop.length; i++) {
    console.log("Send the allocation num: ", i)
    const addresses = allocationsAirdrop[i];
    const amounts = [];
    for (let i = 0; i < addresses.length; i++) {
      amounts.push(amountAirdrop);
    }
    console.log(addresses, amountAirdrop)
    const tx = await IncentiveContract.allocateMany(addresses, amounts);
    await tx.wait();
    console.log(`Allocation ${i} forged`);
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
