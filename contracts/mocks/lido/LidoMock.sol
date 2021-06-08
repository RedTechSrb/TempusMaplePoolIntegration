// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.5;

import "./StETH.sol";

// This is a simplified version of Lido, which maintains API compatibility on:
// - the token interface
// - entering the pool
// - having a buffer for ether to be validated
// - having a reward scheme
contract LidoMock is StETH {
    // The current balance on the beacon chain.
    uint256 internal beaconBalance = 0;
    // Pending ether for submissions to the deposit contract
    uint256 internal bufferedEther = 0;
    // Fee in basis points (0 <= fee <= 1000)
    uint256 internal feeBasis = 100;

    uint256 internal constant DEPOSIT_SIZE = 32 ether;
    uint256 internal constant DEFAULT_MAX_DEPOSITS_PER_CALL = 16;

    /// @notice Send funds to the pool
    /// @dev Users are able to submit their funds by transacting to the fallback function.
    /// Unlike vanilla Eth2.0 Deposit contract, accepting only 32-Ether transactions, Lido
    /// accepts payments of any size. Submitted Ethers are stored in Buffer until someone calls
    /// depositBufferedEther() and pushes them to the ETH2 Deposit contract.
    receive() external payable {
        _submit(address(0));
    }

    /// @notice Send funds to the pool with optional _referral parameter
    /// @dev This function is alternative way to submit funds. Supports optional referral address.
    /// @return Amount of StETH shares generated
    function submit(address _referral) external payable returns (uint256) {
        return _submit(_referral);
    }

    // Submit pending ether to the deposit contract.
    function depositBufferedEther() external {
        return _depositBufferedEther(DEFAULT_MAX_DEPOSITS_PER_CALL);
    }

    // Submit pending ether to the deposit contract.
    function depositBufferedEther(uint256 _maxDeposits) external {
        return _depositBufferedEther(_maxDeposits);
    }

    // Update balance based on beacon chain.
    // This can be only called by LidoOracle.
    function pushBeacon(uint256 _beaconValidators, uint256 _beaconBalance) external {
        // Update holdings.
        beaconBalance = _beaconBalance;

        // Simplified.
        distributeRewards(_beaconBalance - (_beaconValidators * DEPOSIT_SIZE));
    }

    // Distribute actual rewards in ether.
    function distributeRewards(uint256 _totalRewards) internal {
        uint256 fees = _totalRewards * feeBasis;
        uint256 sharesToMint = (fees * _getTotalShares()) / ((_getTotalPooledEther() * 1000) - fees);
        _mintShares(address(this), sharesToMint);

        // Transfer to insurance fund
        // Transfer to treasury
    }

    // Adds submitted ether to the buffer.
    function _submit(
        address /*_referral*/
    ) internal returns (uint256) {
        address sender = msg.sender;
        uint256 deposit = msg.value;
        require(deposit != 0, "ZERO_DEPOSIT");

        uint256 sharesAmount = getSharesByPooledEth(deposit);
        if (sharesAmount == 0) {
            // totalControlledEther is 0: either the first-ever deposit or complete slashing
            // assume that shares correspond to Ether 1-to-1
            sharesAmount = deposit;
        }

        _mintShares(sender, sharesAmount);

        // Store for submission
        bufferedEther += deposit;

        return sharesAmount;
    }

    // Deposit buffered ether.
    function _depositBufferedEther(
        uint256 /*_maxDeposits*/
    ) internal {
        // Enough to submit
        if (bufferedEther >= DEPOSIT_SIZE) {
            uint256 numDeposits = bufferedEther / DEPOSIT_SIZE;
            _ETH2Deposit(numDeposits);
            bufferedEther -= numDeposits * DEPOSIT_SIZE;
        }
    }

    // This would call the deposit contract, we just mimic it by burning the values.
    // solhint-disable-next-line func-name-mixedcase
    function _ETH2Deposit(uint256 _numDeposits) internal {
        // TODO: handle this as transientEther?
        beaconBalance += _numDeposits * DEPOSIT_SIZE;

        // TODO: send to a specific address like 0x00...4336 ?
        payable(0).transfer(_numDeposits * DEPOSIT_SIZE);
    }

    // Total holdings.
    function _getTotalPooledEther() internal view override returns (uint256) {
        return beaconBalance + bufferedEther;
    }
}
