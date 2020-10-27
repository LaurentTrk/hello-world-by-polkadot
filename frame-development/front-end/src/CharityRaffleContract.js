import metadata from './CharityRaffleMetadata.json';
import {Abi, ContractPromise, BlueprintPromise} from '@polkadot/api-contract';

export const defaultGasLimit = 300000n * 1000000n;
export const defaultEndowment = 1000000000000000;
const CharityRaffleCodeHash = '0x2b41e723ed29a1e56b5418ce60ab587c935facde7a638ac5d3bbae0e18194383';

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

function saveContract(contract, abi, charityAccount, contractPromise, api) {
    keyring.saveContract(contract.address.toString(), {
        contract: {
            abi: JSON.stringify(abi.json)
        },
        name: "Raffle contract for " + charityAccount.meta.name,
        tags: ["raffle"]
    });
    contractPromise(new ContractPromise(api, abi, contract.address));
}

export async function createCharityRaffleContract(api, accountPair, charityAccount, contractPromise) {
    const abi = new Abi(metadata);
    const blueprint = new BlueprintPromise(api, abi, CharityRaffleCodeHash);
    const unsub = await blueprint.tx
        .new(defaultEndowment, defaultGasLimit, charityAccount.address, 5, 15*60000)
        .signAndSend(accountPair, (result) => {
            if (result.status.isInBlock || result.status.isFinalized) {
                // here we have an additional field in the result, containing the contract
                if (result.contract) {
                    forgetRaffleContracts();
                    saveContract(result.contract, abi, charityAccount, contractPromise, api);
                }
                unsub();
            }
        });
}
