export default async function fakeSign(api, transaction, account) {
    const signingOptions = await getSigningOptions(api, account);
    return transaction.signFake(account, signingOptions);
}

const getSigningOptions = async (api, account) => {
    return api.derive.tx.signingInfo(account).then((signingInfo) => {
        return buildSigningOptions(api, signingInfo);
    });
}

const buildSigningOptions = (api, signingInfo) => {
    return {
        genesisHash: api.genesisHash,
        runtimeVersion: api.runtimeVersion,
        signedExtensions: api.registry.signedExtensions,
        version: api.extrinsicType,
        blockHash: signingInfo.header.hash,
        era: api.registry.createType('ExtrinsicEra', {
            current: signingInfo.header.number,
            period: signingInfo.mortalLength
        }),
        nonce: signingInfo.nonce
    }
}
