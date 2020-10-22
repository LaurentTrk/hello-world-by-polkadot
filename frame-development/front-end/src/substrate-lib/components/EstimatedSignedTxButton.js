import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {Button} from 'semantic-ui-react';
import {allParamsFilled, estimateSignedTransactionFee, signAndSendTransaction} from "../Transactions";

function EstimatedSignedTxButton({
                                     accountPair = null,
                                     label,
                                     setStatus,
                                     setEstimate,
                                     color = 'blue',
                                     style = null,
                                     type = 'QUERY',
                                     attrs = null,
                                     disabled = false,
                                     onSubmit = null,
                                 }) {
    // Hooks
    const [unsub, setUnsub] = useState(null);

    const {palletRpc, callable, inputParams, paramFields} = attrs;

    const txResHandler = ({status}) =>
        status.isFinalized
            ? setStatus(`😉 Finalized. Block hash: ${status.asFinalized.toString()}`)
            : setStatus(`Current transaction status: ${status.type}`);

    const txErrHandler = err =>
        setStatus(`😞 Transaction Failed: ${err.toString()}`);

    const signedTx = async () => {
        const unsub = await signAndSendTransaction(accountPair, attrs, txResHandler, txErrHandler);
        setUnsub(() => unsub);
    };

    const estimateTx = async () => {
        try {
            const transactionFee = await estimateSignedTransactionFee(accountPair, attrs);
            setEstimate(transactionFee);
            setStatus('Fees of ' + transactionFee + ' will be applied to the submission');
        }catch (err){
            setStatus(`😞 Something went wrong when estimate fees: ${err.toString()}`);
        }
    };

    const transaction = async () => {
        if (unsub) {
            unsub();
            setUnsub(null);
        }

        if (type === 'ESTIMATE-TX') {
            setStatus('Querying fee estimate...');
            estimateTx();
        } else {
            setStatus('Sending...');
            signedTx();
            if (onSubmit){
                onSubmit();
            }
        }
    };


    return (
        <Button
            basic
            color={color}
            style={style}
            type='submit'
            onClick={transaction}
            disabled={disabled || !palletRpc || !callable || !allParamsFilled(paramFields, inputParams)}
        >
            {label}
        </Button>
    );
}

// prop type checking
EstimatedSignedTxButton.propTypes = {
    accountPair: PropTypes.object,
    setStatus: PropTypes.func.isRequired,
    type: PropTypes.oneOf([
        'ESTIMATE-TX', 'SIGNED-TX']).isRequired,
    attrs: PropTypes.shape({
        palletRpc: PropTypes.string,
        callable: PropTypes.string,
        inputParams: PropTypes.array,
        paramFields: PropTypes.array
    }).isRequired
};

export {EstimatedSignedTxButton};
