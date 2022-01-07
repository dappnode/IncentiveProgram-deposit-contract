// SPDX-License-Identifier: CC0-1.0

pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../gnosisContracts/interfaces/IERC677.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/**
 * Contract responsible for managing the dappnode incentive program
 * The beneficiaries can make a deposit to the SBC deposit contract without paying the deposit cost
 */
contract IncentiveDepositContract is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct IncentiveData {
        uint256 endTime; // UNIX time in which the incentive ends
        bool isClaimed; // Indicate if the incentive has been claimed
    }

    // Every deposit requires 32 mGNO tokens
    uint256 public constant DEPOSIT_AMOUNT = 32 ether;

    // Duration of the incentive since it's assigned
    uint256 public incentiveDuration;

    // SBC token (mGNO)
    IERC677 public sbcToken;

    // SBC deposit contract
    address public sbcDepositContract;

    // Number of validator that are assigned to every beneficiary
    uint256 public validatorNum;

    // Mapping of beneficiaries to their respective incentive data
    mapping(address => IncentiveData) public addressToIncentive;

    /**
     * @dev Emitted when a incentive is claimed
     */
    event ClaimedIncentive(address indexed beneficary);

    /**
     * @dev Emitted when a new incentive is addded
     */
    event NewIncentive();

    /**
     * @dev Emitted when a incentive is cancel
     */
    event CancelIncentive();

    /**
     * @dev Emitted when a the validator number is updated
     */
    event SetValidatorNum(uint256 newValidatorNum);

    /**
     * @dev Emitted when a the incentive duration is updated
     */
    event SetIncentiveDuration(uint256 newIncentiveDuration);

    function initialize(
        IERC677 _sbcToken,
        address _sbcDepositContract,
        uint256 _validatorNum,
        uint256 _incentiveDuration
    ) public initializer {
        sbcToken = _sbcToken;
        sbcDepositContract = _sbcDepositContract;
        validatorNum = _validatorNum;
        incentiveDuration = _incentiveDuration;
        __Ownable_init();
    }

    /**
     * @dev Allows a beneficiary to claim his incentive, the beneficiary provide the deposit data and the contract pay the deposit cost on his behalf
     * @param data Deposit data that will pass it further to the SBC deposit contract.
     */
    function claimIncentive(bytes calldata data) external {
        require(
            data.length == validatorNum * 176 + 32,
            "IncentiveDepositContract::claimIncentive:: incorrect deposit data length"
        );

        require(
            addressToIncentive[msg.sender].isClaimed == false,
            "IncentiveDepositContract::claimIncentive:: incentive already claimed"
        );

        require(
            addressToIncentive[msg.sender].endTime >= block.timestamp,
            "IncentiveDepositContract::claimIncentive:: incentive timeout"
        );

        addressToIncentive[msg.sender].isClaimed = true;

        sbcToken.transferAndCall(
            sbcDepositContract,
            DEPOSIT_AMOUNT * validatorNum,
            data
        );

        emit ClaimedIncentive(msg.sender);
    }

    /**
     * @dev Add addresses to the incentive program.
     * Also can be used to extend a incentive duration of an address.
     * Only owner can call this method.
     * @param addressArray Array of addresses
     */
    function addBeneficiaries(address[] memory addressArray)
        external
        onlyOwner
    {
        uint256 incentiveEndTime = block.timestamp + incentiveDuration;

        for (uint256 i = 0; i < addressArray.length; i++) {
            addressToIncentive[addressArray[i]].endTime = incentiveEndTime;
        }

        emit NewIncentive();
    }

    /**
     * @dev Allows to cancel an incentive for multiple addresses.
     * Only owner can call this method.
     * @param addressArray Array of addresses.
     */
    function cancelIncentive(address[] memory addressArray) external onlyOwner {
        for (uint256 i = 0; i < addressArray.length; i++) {
            addressToIncentive[addressArray[i]].isClaimed = true;
        }

        emit CancelIncentive();
    }

    /**
     * @dev Allows to set the incentive duration.
     * Only owner can call this method.
     * @param newIncentiveDuration New incentive duration.
     */
    function setIncentiveDuration(uint256 newIncentiveDuration)
        external
        onlyOwner
    {
        incentiveDuration = newIncentiveDuration;

        emit SetIncentiveDuration(newIncentiveDuration);
    }

    /**
     * @dev Allows to set a new validator number.
     * Only owner can call this method.
     * @param newValidatorNum New validator number.
     */
    function setValidatorNum(uint256 newValidatorNum) external onlyOwner {
        validatorNum = newValidatorNum;

        emit SetValidatorNum(newValidatorNum);
    }

    /**
     * @dev Allows to transfer any token from this contract.
     * Only owner can call this method.
     * @param _token Address of the token.
     * @param _to Adress that will receive the tokens from this contract.
     */
    function claimTokens(IERC20Upgradeable _token, address _to)
        external
        onlyOwner
    {
        uint256 balance = _token.balanceOf(address(this));
        _token.safeTransfer(_to, balance);
    }
}
