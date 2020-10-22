import utils from "./utils";
import {web3FromSource} from "@polkadot/extension-dapp";
import fakeSign from "./FakeSign";
import {queryFeeThroughSidecar} from "./SideCar";

const transformParams = (paramFields, inputParams, opts = {emptyAsNull: true}) => {
    // if `opts.emptyAsNull` is true, empty param value will be added to res as `null`.
    //   Otherwise, it will not be added
    const paramVal = inputParams.map(inputParam => {
        // To cater the js quirk that `null` is a type of `object`.
        if (typeof inputParam === 'object' && inputParam !== null && typeof inputParam.value === 'string') {
            return inputParam.value.trim();
        } else if (typeof inputParam === 'string') {
            return inputParam.trim();
        }
        return inputParam;
    });
    const params = paramFields.map((field, ind) => ({...field, value: paramVal[ind] || null}));

    return params.reduce((memo, {type = 'string', value}) => {
        if (value == null || value === '') return (opts.emptyAsNull ? [...memo, null] : memo);

        let converted = value;

        // Deal with a vector
        if (type.indexOf('Vec<') >= 0) {
            converted = converted.split(',').map(e => e.trim());
            converted = converted.map(single => isNumType(type)
                ? (single.indexOf('.') >= 0 ? Number.parseFloat(single) : Number.parseInt(single))
                : single
            );
            return [...memo, converted];
        }

        // Deal with a single value
        if (isNumType(type)) {
            converted = converted.indexOf('.') >= 0 ? Number.parseFloat(converted) : Number.parseInt(converted);
        }
        return [...memo, converted];
    }, []);
};

const isNumType = type =>
    utils.paramConversion.num.some(el => type.indexOf(el) >= 0);

const getFromAcct = async (accountPair) => {
    const {
        address,
        meta: {source, isInjected}
    } = accountPair;
    let fromAcct;

    // signer is from Polkadot-js browser extension
    if (isInjected) {
        const injected = await web3FromSource(source);
        fromAcct = address;
        api.setSigner(injected.signer);
    } else {
        fromAcct = accountPair;
    }

    return fromAcct;
};

const signAndSendTransaction = async (accountPair, attrs, txResHandler, txErrHandler) => {
    const fromAcct = await getFromAcct(accountPair);
    const txExecute = await getTransaction(attrs);
    return txExecute.signAndSend(fromAcct, txResHandler)
        .catch(txErrHandler);
};

const sendTransaction = async (attrs, txResHandler, txErrHandler) => {
    const txExecute = await getTransaction(attrs);
    return txExecute.send(txResHandler)
        .catch(txErrHandler);
};

const sendSudoTransaction = async (accountPair, attrs, txResHandler, txErrHandler) => {
    const fromAcct = await getFromAcct(accountPair);
    const txExecute = await getSudoTransaction(attrs);
    return txExecute.signAndSend(fromAcct, txResHandler)
        .catch(txErrHandler);
};

const sendUncheckedSudoTransaction = async (accountPair, attrs, txResHandler, txErrHandler) => {
    const fromAcct = await getFromAcct(accountPair);
    const txExecute = await getUncheckedSudoTransaction(attrs);
    return txExecute.signAndSend(fromAcct, txResHandler)
        .catch(txErrHandler);
};

const estimateSignedTransactionFee = async (accountPair, attrs) => {
    const fromAcct = await getFromAcct(accountPair);
    const txExecute = await getTransaction(attrs);
    const signedTransaction = await fakeSign(api, txExecute, fromAcct);
    return queryFeeThroughSidecar(signedTransaction.toHex());
    // Simpler way with paymentInfo
    // txExecute.paymentInfo(fromAcct).then((value) => {
    //     console.log(value.partialFee.toHuman());
    //     setStatus(value.partialFee.toHuman())
    // })
};

async function getTransaction(attrs) {
    const {palletRpc, callable, inputParams, paramFields} = attrs;
    const transformed = transformParams(paramFields, inputParams);
    return transformed
        ? api.tx[palletRpc][callable](...transformed)
        : api.tx[palletRpc][callable]();
}

async function getSudoTransaction(attrs) {
    const {palletRpc, callable, inputParams, paramFields} = attrs;
    const transformed = transformParams(paramFields, inputParams);
    return transformed
        ? api.tx.sudo.sudo(api.tx[palletRpc][callable](...transformed))
        : api.tx.sudo.sudo(api.tx[palletRpc][callable]());
}

async function getUncheckedSudoTransaction(attrs) {
    const {palletRpc, callable, inputParams, paramFields} = attrs;
    return api.tx.sudo.sudoUncheckedWeight(api.tx[palletRpc][callable](...inputParams), 0);
}
const allParamsFilled = (paramFields, inputParams) => {
    if (paramFields.length === 0) {
        return true;
    }

    return paramFields.every((paramField, ind) => {
        const param = inputParams[ind];
        if (paramField.optional) {
            return true;
        }
        if (param == null) {
            return false;
        }

        const value = typeof param === 'object' ? param.value : param;
        return value !== null && value !== '';
    });
};



export {transformParams,
        sendTransaction,
        signAndSendTransaction,
        sendSudoTransaction,
        sendUncheckedSudoTransaction,
        estimateSignedTransactionFee,
        allParamsFilled};
