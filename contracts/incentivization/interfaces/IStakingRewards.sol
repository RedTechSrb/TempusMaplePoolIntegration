pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// https://docs.synthetix.io/contracts/source/interfaces/istakingrewards
interface IStakingRewards {
    // Views

    function balanceOf(address account) external view returns (uint256);

    function earned(address account) external view returns (uint256);

    function getRewardForDuration() external view returns (uint256);

    function lastTimeRewardApplicable() external view returns (uint256);

    function rewardPerToken() external view returns (uint256);

    function rewardsDistribution() external view returns (address);

    function rewardsToken() external view returns (IERC20);

    function totalSupply() external view returns (uint256);

    // Mutative

    function exit() external;

    function getReward() external;

    function stake(uint256 amount) external;

    function withdraw(uint256 amount) external;

    /// Non-standard methods (that don't exist in the Synthetix StakingRewards implementation)
    function stake(uint256 amount, address onBehalfOf) external;

    function withdraw(uint256 amount, address onBehalfOf) external;
}
