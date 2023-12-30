// SPDX-License-Identifier: CC0-1.0

pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IDepositContractLukso.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/**
 * Contract responsible for managing the dappnode incentive program on Lukso
 * Allows the beneficiarys to provide the deposit data for N validators
 * and this contract will pay the deposit cost on his behalf
 */
contract IncentiveLuksoDepositContract is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct IncentiveData {
        uint256 endTime; // UNIX time in which the incentive ends
        bool isClaimed; // Indicate if the incentive has been claimed
    }

    // Every deposit requires 32 LUKSO
    uint256 public constant DEPOSIT_AMOUNT = 32 ether;

    // Lukso deposit contract
    IDepositContractLukso public constant LUKSO_DEPOSIT_CONTRACT =
        IDepositContractLukso(0xCAfe00000000000000000000000000000000CAfe);

    // Duration of the incentive since it's assigned
    uint256 public incentiveDuration;

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
    event NewIncentive(address[] addressArray);

    /**
     * @dev Emitted when a incentive is renewed
     */
    event RenewIncentive(address[] addressArray);

    /**
     * @dev Emitted when a incentive is cancel
     */
    event CancelIncentive(address[] addressArray);

    /**
     * @dev Emitted when a the validator number is updated
     */
    event SetValidatorNum(uint256 newValidatorNum);

    /**
     * @dev Emitted when a the incentive duration is updated
     */
    event SetIncentiveDuration(uint256 newIncentiveDuration);

    function initialize(
        uint256 _validatorNum,
        uint256 _incentiveDuration
    ) public initializer {
        validatorNum = _validatorNum;
        incentiveDuration = _incentiveDuration;
        __Ownable_init();
    }

    /**
     * @notice Be able to receive ether
     **/
    fallback() external payable {}

    /**
     * @dev Allows a beneficiary to claim his incentive, the beneficiary provide the deposit data and the contract pay the deposit cost on his behalf
     * @param data Deposit data, encoded the same way that SBCDepositContract, see: https://github.com/NethermindEth/gnosischain-deposit-contract/blob/master/contracts/SBCDepositContract.sol#L120
      in the will pass it further to the LUKSO deposit contract.
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

        // Mark as claimed incentive
        addressToIncentive[msg.sender].isClaimed = true;

        // Decode data and deposit validators
        bytes memory withdrawal_credentials = data[0:32];

        for (uint256 p = 32; p < data.length; p += 176) {
            bytes memory pubkey = data[p:p + 48];
            bytes memory signature = data[p + 48:p + 144];
            bytes32 deposit_data_root = bytes32(data[p + 144:p + 176]);
            LUKSO_DEPOSIT_CONTRACT.deposit{value: DEPOSIT_AMOUNT}(
                pubkey,
                withdrawal_credentials,
                signature,
                deposit_data_root
            );
        }

        emit ClaimedIncentive(msg.sender);
    }

    /**
     * @dev Add addresses to the incentive program.
     * Only owner can call this method.
     * @param addressArray Array of addresses
     */
    function addBeneficiaries(
        address[] memory addressArray
    ) external onlyOwner {
        uint256 incentiveEndTime = block.timestamp + incentiveDuration;

        for (uint256 i = 0; i < addressArray.length; i++) {
            IncentiveData storage incentive = addressToIncentive[
                addressArray[i]
            ];
            if (incentive.endTime == 0 && incentive.isClaimed == false)
                incentive.endTime = incentiveEndTime;
        }

        emit NewIncentive(addressArray);
    }

    /**
     * @dev Renew addresses to the incentive program.
     * Only owner can call this method.
     * @param addressArray Array of addresses
     */
    function renewBeneficiaries(
        address[] memory addressArray
    ) external onlyOwner {
        uint256 incentiveEndTime = block.timestamp + incentiveDuration;

        for (uint256 i = 0; i < addressArray.length; i++) {
            IncentiveData storage incentive = addressToIncentive[
                addressArray[i]
            ];
            if (incentive.endTime != 0 && incentive.isClaimed == false)
                addressToIncentive[addressArray[i]].endTime = incentiveEndTime;
        }

        emit RenewIncentive(addressArray);
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

        emit CancelIncentive(addressArray);
    }

    /**
     * @dev Allows to set the incentive duration.
     * Only owner can call this method.
     * @param newIncentiveDuration New incentive duration.
     */
    function setIncentiveDuration(
        uint256 newIncentiveDuration
    ) external onlyOwner {
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
     * @dev Allows to transfer any token or native asset from this contract.
     * Only owner can call this method.
     * @param _token Address of the token. 0 reserved for native asset.
     * @param _to Adress that will receive the tokens from this contract.
     */
    function claimTokens(
        IERC20Upgradeable _token,
        address _to
    ) external onlyOwner {
        if (address(_token) == address(0)) {
            // transfer native assets
            (bool success, ) = _to.call{value: address(this).balance}(
                new bytes(0)
            );

            require(
                success,
                "IncentiveDepositContract::claimTokens: Eth transfer failed"
            );
        } else {
            // transfer tokens
            uint256 balance = _token.balanceOf(address(this));
            _token.safeTransfer(_to, balance);
        }
    }
}
