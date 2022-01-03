// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../gnosisContracts/SBCToken.sol";
import "../gnosisContracts/SBCDepositContract.sol";

/**
 * Incentive program that will allow some whitelisted users to make a deposit on the SBC deposit contract without paying the deposit cost
 */
contract IncentiveDepositContract is OwnableUpgradeable {
    SBCToken public sbcToken;
    SBCDepositContract public sbcDepositContract;

    uint256 public constant DEPOSIT_AMOUNT = 32 ether;

    function initialize(SBCToken _sbcToken, SBCDepositContract _depositContract)
        public
        initializer
    {
        sbcToken = _sbcToken;
        sbcDepositContract = _depositContract;
        __Ownable_init();
    }

    /**
     * @dev Deposit 32 mGNO into SBC depositContract in behalf of a whitelisted address
     * @param data Deposit data that will pass it further to the SBC deposit contract.
     */
    function claimIncentive(bytes calldata data) external onlyOwner {
        sbcToken.transferAndCall(
            address(sbcDepositContract),
            DEPOSIT_AMOUNT,
            data
        );
    }
}
