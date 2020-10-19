import metadata from './KdtMetadata.json';
import {Abi, ContractPromise} from '@polkadot/api-contract';

export const defaultGasLimit = 300000n * 1000000n;
const KdtContractAddress = 'EAEqzfVFqSDqLSvYhWaRAXXJMBKKPH7xcSno6AVMbb7VxNc';

export default function KdtContract(api) {
    const abi = new Abi(metadata);
    return new ContractPromise(api, abi, KdtContractAddress);
}

export function displayKdt(balance) {
    return balance.toString() + ' KDT';
}
