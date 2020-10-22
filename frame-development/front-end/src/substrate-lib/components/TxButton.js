import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'semantic-ui-react';
import { useSubstrate } from '../';
import {
  allParamsFilled,
  sendSudoTransaction,
  sendTransaction,
  sendUncheckedSudoTransaction,
  signAndSendTransaction, transformParams
} from "../Transactions";

function TxButton ({
                     accountPair = null,
                     label,
                     setStatus,
                     color = 'blue',
                     style = null,
                     type = 'QUERY',
                     attrs = null,
                     disabled = false
                   }) {
  // Hooks
  const { api } = useSubstrate();
  const [unsub, setUnsub] = useState(null);
  const [sudoKey, setSudoKey] = useState(null);

  const { palletRpc, callable, inputParams, paramFields } = attrs;

  const isQuery = () => type === 'QUERY';
  const isSudo = () => type === 'SUDO-TX';
  const isUncheckedSudo = () => type === 'UNCHECKED-SUDO-TX';
  const isUnsigned = () => type === 'UNSIGNED-TX';
  const isSigned = () => type === 'SIGNED-TX';
  const isRpc = () => type === 'RPC';
  const isConstant = () => type === 'CONSTANT';

  const loadSudoKey = () => {
    (async function () {
      if (!api || !api.query.sudo) { return; }
      const sudoKey = await api.query.sudo.key();
      sudoKey.isEmpty ? setSudoKey(null) : setSudoKey(sudoKey.toString());
    })();
  };

  useEffect(loadSudoKey, [api]);

  const txResHandler = ({ status }) =>
      status.isFinalized
          ? setStatus(`😉 Finalized. Block hash: ${status.asFinalized.toString()}`)
          : setStatus(`Current transaction status: ${status.type}`);

  const txErrHandler = err =>
      setStatus(`😞 Transaction Failed: ${err.toString()}`);

  const sudoTx = async () => {
    const unsub = await sendSudoTransaction(accountPair, attrs, txResHandler, txErrHandler);
    setUnsub(() => unsub);
  };

  const uncheckedSudoTx = async () => {
    const unsub = await sendUncheckedSudoTransaction(accountPair, attrs, txResHandler, txErrHandler);
    setUnsub(() => unsub);
  };

  const signedTx = async () => {
    const unsub = await signAndSendTransaction(accountPair, attrs, txResHandler, txErrHandler);
    setUnsub(() => unsub);
  };

  const unsignedTx = async () => {
    const unsub = await sendTransaction(attrs, txResHandler, txErrHandler);
    setUnsub(() => unsub);
  };

  const queryResHandler = result =>
      result.isNone ? setStatus('None') : setStatus(result.toString());

  const query = async () => {
    const transformed = transformParams(paramFields, inputParams);
    const unsub = await api.query[palletRpc][callable](...transformed, queryResHandler);
    setUnsub(() => unsub);
  };

  const rpc = async () => {
    const transformed = transformParams(paramFields, inputParams, { emptyAsNull: false });
    const unsub = await api.rpc[palletRpc][callable](...transformed, queryResHandler);
    setUnsub(() => unsub);
  };

  const constant = () => {
    const result = api.consts[palletRpc][callable];
    result.isNone ? setStatus('None') : setStatus(result.toString());
  };

  const transaction = async () => {
    if (unsub) {
      unsub();
      setUnsub(null);
    }

    setStatus('Sending...');

    (isSudo() && sudoTx()) ||
    (isUncheckedSudo() && uncheckedSudoTx()) ||
    (isSigned() && signedTx()) ||
    (isUnsigned() && unsignedTx()) ||
    (isQuery() && query()) ||
    (isRpc() && rpc()) ||
    (isConstant() && constant());
  };

  const isSudoer = acctPair => {
    if (!sudoKey || !acctPair) { return false; }
    return acctPair.address === sudoKey;
  };

  return (
      <Button
          basic
          color={color}
          style={style}
          type='submit'
          onClick={transaction}
          disabled={ disabled || !palletRpc || !callable || !allParamsFilled(paramFields, inputParams) ||
          ((isSudo() || isUncheckedSudo()) && !isSudoer(accountPair)) }
      >
        {label}
      </Button>
  );
}

// prop type checking
TxButton.propTypes = {
  accountPair: PropTypes.object,
  setStatus: PropTypes.func.isRequired,
  type: PropTypes.oneOf([
    'QUERY', 'RPC', 'SIGNED-TX', 'UNSIGNED-TX', 'SUDO-TX', 'UNCHECKED-SUDO-TX',
    'CONSTANT']).isRequired,
  attrs: PropTypes.shape({
    palletRpc: PropTypes.string,
    callable: PropTypes.string,
    inputParams: PropTypes.array,
    paramFields: PropTypes.array
  }).isRequired
};

function TxGroupButton (props) {
  return (
      <Button.Group>
        <TxButton
            label='Unsigned'
            type='UNSIGNED-TX'
            color='grey'
            {...props}
        />
        <Button.Or />
        <TxButton
            label='Signed'
            type='SIGNED-TX'
            color='blue'
            {...props}
        />
        <Button.Or />
        <TxButton
            label='SUDO'
            type='SUDO-TX'
            color='red'
            {...props}
        />
      </Button.Group>
  );
}

export { TxButton, TxGroupButton };
