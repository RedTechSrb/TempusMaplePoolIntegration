import { Contract } from "ethers";
import { Numberish } from "./DecimalUtils";
import { ERC20OwnerMintable } from "./ERC20OwnerMintable";

export enum ShareKind {
  Principal = "PrincipalShare",
  Yield = "YieldShare",
}

export class PoolShare extends ERC20OwnerMintable {
  constructor(contractName:string, decimals:number, contract:Contract) {
    super(contractName, decimals, contract);
  }

  /**
   * @param kind ShareKind.Principal or ShareKind.Yield
   * @param contractAddress Address of the contract
   * @param decimals Contract decimals
   */
  static async attach(kind:ShareKind, contractAddress:string, decimals:number): Promise<PoolShare> {
    const contractName = kind.toString();
    const contract = await this.attachContract(contractName, contractAddress);
    return new PoolShare(contractName, decimals, contract);
  }

  /**
   * @returns Updates and gets price per share as described in PoolShare.sol
   */
  async getPricePerFullShare(): Promise<Numberish> {
    // this transaction will update latest PricePerFullShare
    await this.contract.getPricePerFullShare();
    return this.getPricePerFullShareStored(); // fetch the stored PPS
  }

  /**
   * @returns Stored price per share as described in PoolShare.sol
   */
  async getPricePerFullShareStored(): Promise<Numberish> {
    return this.fromBigNum(await this.contract.getPricePerFullShareStored());
  }
}
