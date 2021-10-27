import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { NumberOrString } from "./Decimal";
import { ContractBase, SignerOrAddress, Signer, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { ERC20Ether } from "./ERC20Ether";
import { TokenInfo } from "../pool-utils/TokenInfo";

export class Lido extends ERC20 {
  // asset is ETH
  asset:ERC20Ether; // ERC20 Ether Wrapper (not WETH!)
  yieldToken:ERC20; // StETH

  constructor(pool:Contract, asset:ERC20Ether) {
    super("LidoMock", asset.decimals, pool);
    this.asset = asset;
    this.yieldToken = this; // for Lido, the pool itself is the Yield Token
  }

  /**
   * @param ASSET ASSET token info (IGNORED)
   * @param YIELD YIELD token info
   * @param initialRate Initial interest rate
   */
  static async create(ASSET:TokenInfo, YIELD:TokenInfo, initialRate:Number): Promise<Lido> {
    const asset = new ERC20Ether();
    const pool = await ContractBase.deployContract(
      "LidoMock", YIELD.decimals, YIELD.name, YIELD.symbol
    );
    const lido = new Lido(pool, asset);
    if (initialRate != 1.0) {
      await lido.setInterestRate(initialRate);
    }
    return lido;
  }

  /** @return stETH balance of an user */
  async sharesOf(user:SignerOrAddress): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.sharesOf(addressOf(user)));
  }

  /** @return total stETH shares minted */
  async getTotalShares(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.getTotalShares());
  }

  /** @return the amount of Ether that corresponds to `_sharesAmount` token shares. */
  async getPooledEthByShares(sharesAmount:NumberOrString): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.getPooledEthByShares(this.toBigNum(sharesAmount)));
  }

  /** @return the amount of shares that corresponds to `_ethAmount` protocol-controlled Ether. */
  async getSharesByPooledEth(_ethAmount:NumberOrString): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.getSharesByPooledEth(this.toBigNum(_ethAmount)));
  }

  /** @return total pooled ETH: beaconBalance + bufferedEther */
  async totalSupply(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.totalSupply());
  }

  /** @return Stored Interest Rate */
  async interestRate(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract._getInterestRate());
  }

  /**
   * Sets the pool Interest Rate
   * @param interestRate New synthetic Interest Rate
   */
  async setInterestRate(interestRate:NumberOrString): Promise<void> {
    let totalETHSupply:BigNumber = await this.contract.totalSupply();
    // total ETH is 0, so we must actually deposit something, otherwise we can't manipulate the rate
    if (totalETHSupply.isZero()) {
      totalETHSupply = this.toBigNum(1000);
      await this.contract._setSharesAndEthBalance(this.toBigNum(1000), totalETHSupply); // 1.0 rate
    }

    // figure out if newRate requires a change of stETH
    const totalShares:BigNumber = await this.contract.getTotalShares();
    const curRate = await this.contract._getInterestRate();
    const newRate = this.toBigNum(interestRate);
    const ONE = this.toBigNum(1.0);
    const difference = newRate.mul(ONE).div(curRate).sub(ONE);
    if (difference.isZero())
      return;

    const change = totalETHSupply.mul(difference).div(ONE);
    const newETHSupply = totalETHSupply.add(change);
    await this.contract._setSharesAndEthBalance(totalShares, newETHSupply);
  }

  async submit(signer:SignerOrAddress, amount:NumberOrString): Promise<NumberOrString> {
    const val = this.toBigNum(amount); // payable call, set value:
    return await this.connect(signer).submit(addressOf(signer), {value: val})
  }
  async depositBufferedEther(): Promise<void> {
    // ethers.js does not resolve overloads, so need to call the function by string lookup
    await this.contract["depositBufferedEther()"]();
  }
  async depositBufferedEther2(maxDeposits:number): Promise<void> {
    await this.contract["depositBufferedEther(uint256)"](maxDeposits);
  }
  /**
   * Updates the contract with information from ETH2 orcale
   * Calculates rewards using formulae:  rewards = balance - 32*validators
   * @param validators Total number of ACTUAL 32xETH deposits made during deposit event.
   *                   This could be different than # of depositBufferedEther(1) calls.
   * @param balance Actual balance in the ETH2 oracle
   */
  async pushBeacon(owner:Signer, validators:number, balance:number): Promise<void> {
    await this.connect(owner).pushBeacon(validators, this.toBigNum(balance));
  }
  // pushes balance to achieve certain amount of `totalRewards`
  async pushBeaconRewards(owner:Signer, validators:number, rewards:number): Promise<void> {
    // push X eth reward, rewards = balance - 32*validators
    const balance = rewards + 32*validators;
    await this.pushBeacon(owner, validators, balance);
  }
  async withdraw(signer:Signer, shareAmount:Number): Promise<void> {
    // We ignore the pubKeyHash.
    const hash = ethers.utils.formatBytes32String("");
    await this.connect(signer).withdraw(this.toBigNum(shareAmount), hash);
  }
  async printState(title: string, owner: string, user: string) {
    console.log("State:", title);
    console.log("  totalSupply:", await this.totalSupply());
    console.log("  totalShares:", await this.getTotalShares());
    console.log("  owner.shares: ", await this.sharesOf(owner));
    console.log("  owner.balance:", await this.balanceOf(owner));
    console.log("  user.shares: ", await this.sharesOf(user));
    console.log("  user.balance:", await this.balanceOf(user));
  }
}
