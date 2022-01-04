// SPDX-License-Identifier: CC0-1.0

pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../gnosisContracts/SBCToken.sol";
import "../gnosisContracts/SBCDepositContract.sol";
import "../gnosisContracts/utils/Claimable.sol";

/**
 * Incentive program that will allow some whitelisted users to make a deposit on the SBC deposit contract without paying the deposit cost
 */
contract IncentiveDepositContract is OwnableUpgradeable, Claimable {
    struct DepositData {
        uint256 endTime;
        bool isClaimed;
    }

    uint256 public constant DEPOSIT_AMOUNT = 32 ether;
    uint256 public constant DURATION_INCENTIVE = 180 days;

    SBCToken public sbcToken;
    SBCDepositContract public sbcDepositContract;
    uint256 public validatorNum;

    mapping(address => DepositData) public addressToDeposit;

    /**
     * @dev Emitted when a incentive is claimed
     */
    event ClaimedIncentive(address indexed beneficary);

    /**
     * @dev Emitted when a new incentive is addded
     */
    event NewIncentive();

    /**
     * @dev Emitted when a incentive is cancelated
     */
    event CancelIncentive(address indexed recipient);

    /**
     * @dev Emitted when a incentive is cancelated
     */
    event SetValidatorNum(uint256 newValidatorNum);

    function initialize(
        SBCToken _sbcToken,
        SBCDepositContract _sbcDepositContract,
        uint256 _validatorNum
    ) public initializer {
        sbcToken = _sbcToken;
        sbcDepositContract = _sbcDepositContract;
        validatorNum = _validatorNum;
        __Ownable_init();
    }

    /**
     * @dev Deposit 32 mGNO into SBC depositContract in behalf of a whitelisted address
     * @param data Deposit data that will pass it further to the SBC deposit contract.
     */
    function claimIncentive(bytes calldata data) external {
        uint256 count = data.length / 176;
        require(
            count == validatorNum,
            "IncentiveDepositContract::claimIncentive:: incorrect deposit data length"
        );

        require(
            addressToDeposit[msg.sender].isClaimed == false,
            "IncentiveDepositContract::claimIncentive:: incentive already claimed"
        );

        require(
            addressToDeposit[msg.sender].endTime >= block.timestamp,
            "IncentiveDepositContract::claimIncentive:: incentive timeout"
        );

        // set the nullifier
        addressToDeposit[msg.sender].isClaimed = true;

        // call the deposit contract
        sbcToken.transferAndCall(
            address(sbcDepositContract),
            DEPOSIT_AMOUNT * validatorNum,
            data
        );

        emit ClaimedIncentive(msg.sender);
    }

    /**
     * @dev Deposit 32 mGNO into SBC depositContract in behalf of a whitelisted address
     * @param addressArray Deposit data that will pass it further to the SBC deposit contract.
     */
    function addNewIncentive(address[] memory addressArray) external onlyOwner {
        uint256 incentiveEndTime = block.timestamp + DURATION_INCENTIVE;

        for (uint256 i = 0; i < addressArray.length; i++) {
            addressToDeposit[addressArray[i]].endTime = incentiveEndTime;
        }
        emit NewIncentive();
    }

    /**
     * @dev Deposit 32 mGNO into SBC depositContract in behalf of a whitelisted address
     * @param recipient Deposit data that will pass it further to the SBC deposit contract.
     */
    function cancelIncentive(address recipient) external onlyOwner {
        addressToDeposit[recipient].isClaimed = true;

        emit CancelIncentive(recipient);
    }

    /**
     * @dev Deposit 32 mGNO into SBC depositContract in behalf of a whitelisted address
     * @param newValidatorNum Deposit data that will pass it further to the SBC deposit contract.
     */
    function setValidatorNum(uint256 newValidatorNum) external onlyOwner {
        validatorNum = newValidatorNum;
        emit SetValidatorNum(newValidatorNum);
    }

    /**
     * @dev Allows to transfer any token from this contract.
     * Only owner can call this method.
     * @param _token address of the token, if it is not provided (0x00..00), native coins will be transferred.
     * @param _to address that will receive the tokens from this contract.
     */
    function claimTokens(address _token, address _to) external onlyOwner {
        _claimValues(_token, _to);
    }
}
