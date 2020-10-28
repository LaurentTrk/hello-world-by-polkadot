import metadata from './CharityRaffleMetadata.json';
import {Abi, ContractPromise, BlueprintPromise} from '@polkadot/api-contract';

export const defaultGasLimit = 300000n * 1000000n;
export const defaultEndowment = 1000000000000000;
const CharityRaffleCodeHash = '0x19b6a1fdf679c218004b00eda0490ff27cd9298011825f2af9e42d58640c85a8';

export default function CharityRaffleContract(api) {
    const abi = new Abi(metadata);
    let raffleContract = null;
    keyring.getContracts().forEach(contract => {
        if (contract.meta.tags.includes('raffle')) {
            raffleContract = new ContractPromise(api, abi, contract.address);
        }
    })
    return raffleContract;
}

function forgetRaffleContracts() {
    keyring.getContracts().forEach(contract => {
        if (contract.meta.tags.includes('raffle')) {
            keyring.forgetContract(contract.address);
        }
    })
}

function saveContract(contract, abi, contractPromise, api) {
    keyring.saveContract(contract.address.toString(), {
        contract: {
            abi: JSON.stringify(abi.json)
        },
        name: "Raffle contract",
        tags: ["raffle"]
    });
    contractPromise(new ContractPromise(api, abi, contract.address));
}

export async function createCharityRaffleContract(api, accountPair, contractPromise) {
    const abi = new Abi(metadata);
    const blueprint = new BlueprintPromise(api, abi, CharityRaffleCodeHash);
    const unsub = await blueprint.tx
        .new(defaultEndowment, defaultGasLimit, 2, 0)
        .signAndSend(accountPair, (result) => {
            if (result.status.isInBlock || result.status.isFinalized) {
                // here we have an additional field in the result, containing the contract
                if (result.contract) {
                    forgetRaffleContracts();
                    saveContract(result.contract, abi, contractPromise, api);
                }
                unsub();
            }
        });
}
