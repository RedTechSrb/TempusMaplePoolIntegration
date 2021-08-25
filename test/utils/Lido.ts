import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { NumberOrString, toWei, ONE_WEI } from "./Decimal";
import { ContractBase, SignerOrAddress, Signer, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";

/**
 * Type safe wrapper over LidoMock
 */
export class Lido extends ERC20 {
  // asset is ETH
  asset:ERC20; // wETH mock
  yieldToken:ERC20; // StETH

  constructor(pool:Contract, mockAsset:ERC20) {
    super("LidoMock", pool);
    this.asset = mockAsset;
    this.yieldToken = this; // for Lido, the pool itself is the Yield Token
  }

  /**
   * @param totalSupply Total MOCK wETH supply
   * @param initialRate Initial interest rate
   */
  static async create(totalSupply:Number, initialRate:Number = 1.0): Promise<Lido> {
    const asset = await ERC20.deploy("ERC20FixedSupply", "wETH Mock", "wETH", toWei(totalSupply));
    const pool = await ContractBase.deployContract("LidoMock");
    const lido = await new Lido(pool, asset);

    // Deploy a single validator to ensure Lido is never empty to simplify further processing
    // await lido.contract.submit("0x0000000000000000000000000000000000000000", {value: toWei(32)})
    await lido.contract.submit("0x0000000000000000000000000000000000000000", {value: ONE_WEI.mul(32)})

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
    const totalETHSupply:BigNumber = await this.contract.totalSupply();
    if (totalETHSupply.isZero()) {
      // If the pool is empty, this is a no-op.
      return;
    }

    const currentBalance = await this.beaconBalance();
    const beaconValidators = currentBalance.div(ONE_WEI.mul(32));
    const newBalance = currentBalance.mul(interestRate);
    
    console.log(currentBalance, beaconValidators, newBalance)

    await this.contract.pushBeacon(beaconValidators, newBalance);
  }

  async submit(signer:SignerOrAddress, amount:NumberOrString): Promise<NumberOrString> {
    const val = this.toBigNum(amount); // payable call, set value:
    return await this.connect(signer).submit(addressOf(signer), {value: val})
  }
  async beaconBalance() {
    return await this.contract.beaconBalance();
  }
  async depositBufferedEther() {
    // ethers.js does not resolve overloads, so need to call the function by string lookup
    return await this.contract["depositBufferedEther()"]();
  }
  async depositBufferedEther2(maxDeposits:number) {
    return await this.contract["depositBufferedEther(uint256)"](maxDeposits);
  }
  /**
   * Updates the contract with information from ETH2 orcale
   * Calculates rewards using formulae:  rewards = balance - 32*validators
   * @param validators Total number of ACTUAL 32xETH deposits made during deposit event.
   *                   This could be different than # of depositBufferedEther(1) calls.
   * @param balance Actual balance in the ETH2 oracle
   */
  async pushBeacon(owner:Signer, validators:number, balance:number) {
    return await this.connect(owner).pushBeacon(validators, toWei(balance));
  }
  // pushes balance to achieve certain amount of `totalRewards`
  async pushBeaconRewards(owner:Signer, validators:number, rewards:number) {
    // push X eth reward, rewards = balance - 32*validators
    const balance = rewards + 32*validators;
    return await this.pushBeacon(owner, validators, balance);
  }
  async withdraw(signer:Signer, shareAmount:Number) {
    // We ignore the pubKeyHash.
    const hash =  ethers.utils.formatBytes32String("");
    return await this.connect(signer).withdraw(toWei(shareAmount), hash);
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
