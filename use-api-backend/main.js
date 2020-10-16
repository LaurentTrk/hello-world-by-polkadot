const {ApiPromise, WsProvider} = require('@polkadot/api');

const DEFAULT_BLOCKCHAIN_ENDPOINT = 'ws://127.0.0.1:9944';

function getArguments() {
    const commandLineArguments = process.argv.slice(2);
    if (commandLineArguments.length === 0) {
        return [DEFAULT_BLOCKCHAIN_ENDPOINT, null]
    }
    if (commandLineArguments.length === 1) {
        if (commandLineArguments[0].startsWith('ws')) {
            return [commandLineArguments[0], null]
        }
        return [DEFAULT_BLOCKCHAIN_ENDPOINT, commandLineArguments[1]]
    }
    return [commandLineArguments[0], commandLineArguments[1]]
}

async function displayLatestBlock(blockChainWsUrl) {
    const chainApi = await getChainApi(blockChainWsUrl)
    const block = await chainApi.getBlock();
    console.log(`Latest block on ${blockChainWsUrl} : ${block}`);
}

async function displayBlockAt(blockId, blockChainWsUrl) {
    const chainApi = await getChainApi(blockChainWsUrl)
    let block
    if (!blockId.startsWith('0x')) {
        const blockHash = await chainApi.getBlockHash(blockId);
        block = await chainApi.getBlock(blockHash);
    } else {
        block = await chainApi.getBlock(blockId);
    }
    console.log(`Block at ${blockId} on ${blockChainWsUrl} : ${block}`);
}

async function getChainApi(blockChainWsUrl) {
    const provider = new WsProvider(blockChainWsUrl);
    const api = await ApiPromise.create({provider});
    return api.rpc.chain;
}

async function displayBlock() {
    const [blockChainWsUrl, blockId] = getArguments()
    if (blockId != null) {
        await displayBlockAt(blockId, blockChainWsUrl);
    } else {
        await displayLatestBlock(blockChainWsUrl);
    }
}

displayBlock().catch(console.error).finally(() => process.exit());
