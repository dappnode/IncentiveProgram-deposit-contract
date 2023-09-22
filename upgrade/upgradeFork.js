const hre = require("hardhat");
const { ethers, upgrades } = require("hardhat");
const helpers = require('@nomicfoundation/hardhat-network-helpers');

async function main() {
  // compìle contracts
  await hre.run("compile");

  // hard fork
  const rpc = "https://rpc.gnosischain.com"
  await helpers.reset(rpc);

  const incentiveProxyAddress = "0x6C68322cf55f5f025F2aebd93a28761182d077c3";
  const proxyAdmin = "0x8Eb6EC9600155F47620503F8dC638ed9a64975be"

  const IncentiveFactory = await ethers.getContractFactory("IncentiveDepositContract");
  const proxyAdminFactory = await ethers.getContractFactory("ProxyAdmin");

  const proxyAdminContract = proxyAdminFactory.attach(proxyAdmin)

  const SBCTokenFactory = await ethers.getContractFactory('SBCToken')
  const SBCDepositContractFactory = await ethers.getContractFactory('SBCDepositContract')

  const sbcTokenAddress = "0x722fc4DAABFEaff81b97894fC623f91814a1BF68";
  const sbcDepositContractAddress = "0x0B98057eA310F4d31F2a452B414647007d1645d9";
  const gnoToken = "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb"

  const SBCTokenContract = SBCTokenFactory.attach(sbcTokenAddress)
  const sbcDepositContractContract = SBCDepositContractFactory.attach(sbcDepositContractAddress)
  const gnoTokenContract = SBCTokenFactory.attach(gnoToken)

  const IncentiveDepositContractFactory = await ethers.getContractFactory('IncentiveDepositContract')
  const incentiveDepositContractImpl = await IncentiveDepositContractFactory.deploy()

  // Upgrade 
  const owner = await proxyAdminContract.owner();
  await helpers.impersonateAccount(owner);
  const txSender = await ethers.getSigner(owner);
  await proxyAdminContract.connect(txSender).upgrade(incentiveProxyAddress, incentiveDepositContractImpl.address)


  const incentiveDepositContract = IncentiveDepositContractFactory.attach(incentiveProxyAddress)
  const ownerIncentive = await incentiveDepositContract.owner();
  await helpers.impersonateAccount(ownerIncentive);
  const ownerIncentiveSigner = await ethers.getSigner(ownerIncentive);

  let currentGNOBalance = await gnoTokenContract.balanceOf(incentiveProxyAddress);
  let currentmGNOBalance = await SBCTokenContract.balanceOf(incentiveProxyAddress);
  console.log({ currentGNOBalance }, { currentmGNOBalance })

  await helpers.setBalance(ownerIncentiveSigner.address, 100n ** 18n);
  await incentiveDepositContract.connect(ownerIncentiveSigner).unwrapMGNO()

  currentGNOBalance = await gnoTokenContract.balanceOf(incentiveProxyAddress);
  currentmGNOBalance = await SBCTokenContract.balanceOf(incentiveProxyAddress);
  console.log({ currentGNOBalance }, { currentmGNOBalance })


  // try to claim, get one failed transaction:
  const txHashClaim = "0x3937c9be616677a3a8c7162bf88229d1498155ee66d4047f12459be3a097333b"
  const getCurrentTx = await ethers.provider.getTransaction(txHashClaim);
  await helpers.impersonateAccount(getCurrentTx.from);
  const txSenderClaim = await ethers.getSigner(getCurrentTx.from);
  const copyTxParams = (({
    to, value, data,
  }) => ({
    to, value, data,
  }))(getCurrentTx);

  await incentiveDepositContract.connect(ownerIncentiveSigner).renewBeneficiaries([getCurrentTx.from])

  const receipt = await (await txSenderClaim.sendTransaction(copyTxParams)).wait();
  console.log(receipt)

  currentGNOBalance = await gnoTokenContract.balanceOf(incentiveProxyAddress);
  console.log({ currentGNOBalance })
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
