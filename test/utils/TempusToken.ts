import { NumberOrString } from "./Decimal";
import { SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { Signer } from "crypto";
import { Transaction } from "@ethersproject/transactions";

/**
 * Type safe wrapper of TempusToken
 */
export class TempusToken extends ERC20 {
  constructor() {
    super("TempusToken", 18);
  }

  /**
   * Burn the token holder's own tokens.
   * @param sender Account that is issuing the burn.
   * @param amount Number of tokens to burn
   */
  async burn(sender:SignerOrAddress, amount:NumberOrString): Promise<void> {
    await this.connect(sender).burn(this.toBigNum(amount));
  }

  /**
   * Mint some tokens
   * @param sender Account that is allowed to mint tokens
   * @param account Account to which we issue tokens
   * @param amount Number of tokens to mint
   */
  async mint(sender:SignerOrAddress, account:SignerOrAddress, amount:NumberOrString): Promise<Transaction> {
    return this.connect(sender).mint(addressOf(account), this.toBigNum(amount));
  }

  /**
   * @returns The timestamp after which minting is allowed
   */
  async mintAllowedAfter(): Promise<number> {
    return this.contract.mintingAllowedAfter();
  }

  /**
   * @returns The timestamp of last minting occurance
   */
  async lastMintingTime(): Promise<number> {
    return this.contract.lastMintingTime();
  }
}
