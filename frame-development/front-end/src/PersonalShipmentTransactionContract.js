import metadata from './PersonalShipmentTransactionMetadata.json';
import {Abi, ContractPromise, BlueprintPromise} from '@polkadot/api-contract';

export const defaultGasLimit = 300000n * 1000000n;
export const defaultEndowment = 1000000000000000;
export const PersonalShipmentTransactionContractCodeHash = '0x397e22075073cb538c503fb1297cffc230e8132b5d3af98b55ebccfd2b773238';

export default function PersonalShipmentTransactionContract(api) {
    const abi = new Abi(metadata);
    let personalShipmentTransactionContract = null;
    keyring.getContracts().forEach(contract => {
        if (contract.meta.tags.includes('pst')) {
            personalShipmentTransactionContract = new ContractPromise(api, abi, contract.address);
        }
    })
    return personalShipmentTransactionContract;
}

function forgetPersonalShipmentTransactionContracts() {
    keyring.getContracts().forEach(contract => {
        if (contract.meta.tags.includes('pst')) {
            keyring.forgetContract(contract.address);
        }
    })
}

function saveContract(contract, abi, contractPromise, api) {
    keyring.saveContract(contract.address.toString(), {
        contract: {
            abi: JSON.stringify(abi.json)
        },
        name: "Personal Shipment Transaction",
        tags: ["pst"]
    });
    contractPromise(new ContractPromise(api, abi, contract.address));
}

export async function createPersonalShipmentTransactionContract(api, accountPair, contractPromise) {
    const abi = new Abi(metadata);
    const blueprint = new BlueprintPromise(api, abi, PersonalShipmentTransactionContractCodeHash);
    const unsub = await blueprint.tx
        .new(defaultEndowment, defaultGasLimit, 2, 0)
        .signAndSend(accountPair, (result) => {
            if (result.status.isInBlock || result.status.isFinalized) {
                // here we have an additional field in the result, containing the contract
                if (result.contract) {
                    forgetPersonalShipmentTransactionContracts();
                    saveContract(result.contract, abi, contractPromise, api);
                }
                unsub();
            }
        });
}

