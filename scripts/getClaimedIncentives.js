process.env.HARDHAT_NETWORK = "xDAI";
const hre = require("hardhat");
const { ethers } = require("hardhat");
const path = require('path');
const fs = require('fs');

const pathOutputJson = path.join(__dirname, './allocationsAirdrop.json');

async function main() {
  // compìle contracts
  const IncentiveFactory = await ethers.getContractFactory("IncentiveDepositContract");
  const incentiveProxyAddress = "0x6C68322cf55f5f025F2aebd93a28761182d077c3";
  const IncentiveContract = await IncentiveFactory.attach(incentiveProxyAddress);


  const filter = IncentiveContract.filters.ClaimedIncentive(null);
  const events = await IncentiveContract.queryFilter(filter, 0, "latest");

  const addressArray = [];
  for (let i = 0; i < events.length; i++) {
    const currentEvent = events[i];
    const currentAddress = currentEvent.args.beneficary;
    if (addressArray.includes(currentAddress)) {
      console.log("WTF ERROR")
    }
    addressArray.push(currentAddress);
  }
  console.log("event length: ", events.length);
  console.log("address length: ", addressArray.length);
  if (events.length != addressArray.length) {
    console.log("Error different len events and address");
  }

  const allocationsNum = 10;
  const accountsForAllocation = Math.ceil(addressArray.length / allocationsNum);

  let currentAccount = 0;
  const allocationsArray = [];

  for (let i = 0; i < allocationsNum; i++) {
    const currentAllocation = [];
    for (let j = 0; j < accountsForAllocation; j++) {
      currentAllocation.push(addressArray[currentAccount])
      currentAccount++;
      if (currentAccount == addressArray.length) {
        break;
      }
    }
    allocationsArray.push(currentAllocation);
  }

  // Check everything goes alright
  addressArray.forEach(address => {
    let found = false;
    for (let i = 0; i < allocationsArray.length; i++) {
      if (allocationsArray[i].includes(address)) {
        found = true;
        break;
      }
    }
    if (found == false) {
      console.log("ERROR, not found in allocation aray");
    }
  });

  let totalAddress = 0;
  allocationsArray.forEach(allocation => {
    totalAddress += allocation.length;
  });

  if (totalAddress != addressArray.length) {
    console.log("Error different len allocations and address");
  }
  fs.writeFileSync(pathOutputJson, JSON.stringify(allocationsArray, null, 1));

}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
