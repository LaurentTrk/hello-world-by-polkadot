import React, {useEffect, useState} from 'react';
import {Button, Segment, Header, Dropdown, Form, Grid, Icon, Checkbox, Step, Input, Label, Message} from 'semantic-ui-react';

import {useSubstrate} from './substrate-lib';
import PersonalShipmentTransactionContract, {
    defaultGasLimit,
    PersonalShipmentTransactionContractCodeHash
} from "./PersonalShipmentTransactionContract";
import {Abi, BlueprintPromise, ContractPromise} from "@polkadot/api-contract";
import metadata from "./PersonalShipmentTransactionMetadata.json";


function Main(props) {
    const {api, keyring} = useSubstrate();
    const {accountPair} = props;
    const ONE_UNIT = 1000000000000000;
    const EXISTENTIAL_DEPOSIT = 1000000;
    const TRANSACTION_DEPOSIT_PER_STAKEHOLDER = ONE_UNIT + EXISTENTIAL_DEPOSIT;

    const findAccountNameByAddress = (accountAddress) => {
        const accounts = keyring.getPairs();
        let accountName = accountAddress;
        accounts.forEach(({address, meta, publicKey}) => {
            if (address === accountAddress && meta.name) {
                accountName = meta.name.charAt(0).toUpperCase() +  meta.name.slice(1);
            }
        });
        return accountName;
    }

    const findAccountByAddress = (accountAddress) => {
        const accounts = keyring.getPairs();
        let accountFound = null;
        accounts.forEach((account) => {
            if (accountAddress === account.address) {
                accountFound = account;
            }
        });
        return accountFound;
    }

    const keyringOptions = keyring.getPairs().map(account => ({
        key: account.address,
        value: account.address,
        text: account.meta.name ? account.meta.name.toUpperCase():account.address,
        icon: 'user'
    }));

    const [personalShipmentTransactionContract, setPersonalShipmentTransactionContract] = useState(PersonalShipmentTransactionContract(api));
    const [multiSigTimePoint, setMultiSigTimePoint] = useState(null);
    const [trackingNumber, setTrackingNumber] = useState('');
    const [trackingNumberToSet, setTrackingNumberToSet] = useState('');
    const [sender, setSender] = useState(null);
    const [receiver, setReceiver] = useState(null);
    const [receiverPayment, setReceiverPayment] = useState(0);
    const [goodsValue, setGoodsValue] = useState(0);
    const [goodsDescription, setGoodsDescription] = useState('');
    const [transactionStatus, setTransactionStatus] = useState('');
    const [statusRefreshing, setStatusRefreshing] = useState(false);
    const [signaturePending, setSignaturePending] = useState(false);

    const onSelectReceiver = async (address) => {
        setReceiver(findAccountByAddress(address));
        setSender(accountPair);
        const {multiSigTimePoint, firstApproval, callData} = await retrievePendingNonApprovedTransaction(accountPair.address, address);
        if (multiSigTimePoint){
            setMultiSigTimePoint(multiSigTimePoint);
        }
        // TODO : retrieve contract values from pending non approved trnasaction
    }

    const retrievePendingNonApprovedTransaction = async (senderAddress, receiverAddress) => {
        const {signersAccount} = getMultisigSigners(senderAddress, receiverAddress);
        const pendingMultiSigs = await api.query.multisig.multisigs.entries(signersAccount.address);
        let multiSigTimePoint = null;
        let firstApproval = null;
        let callData = null;
        pendingMultiSigs.forEach(([{ args: [pendingAccount, pendingHash] }, pendingMultiSig]) => {
            firstApproval = pendingMultiSig.value.approvals[0].toString();
            console.log("Pending multisig between sender and receiver signed by " + firstApproval);
            multiSigTimePoint = pendingMultiSig.value.when;
            api.query.multisig.calls(pendingHash).then((pendingCallData) => {
                const [opaqueCall, accountId, balanceOf] = pendingCallData.value;
                callData = opaqueCall;
            });
        });
        return {multiSigTimePoint, firstApproval,callData}
    }

    const onTrackingNumberChange = (event, data) => setTrackingNumberToSet(data.value);

    const pay = () => {
        const paymentAmount = goodsValueNumber();
        console.log(paymentAmount);
        personalShipmentTransactionContract.tx.pay(goodsValueNumber(), defaultGasLimit).signAndSend(accountPair, () => {
        });
    }

    const refresh = () => {
        setStatusRefreshing(true);
        personalShipmentTransactionContract.tx.updateShipmentStatus(0, defaultGasLimit).signAndSend(accountPair, () => {
        });
    }

    const setContractTrackingNumber = () => {
        personalShipmentTransactionContract.tx.setTrackingNumber(0, defaultGasLimit, trackingNumberToSet).signAndSend(accountPair, () => {
        });
    }

    const deployTransactionContractCall = async (senderAddress, receiverAddress) => {
        const abi = new Abi(metadata);
        const blueprint = new BlueprintPromise(api, abi, PersonalShipmentTransactionContractCodeHash);
        const tx = await blueprint.tx
            .new(2 * ONE_UNIT, defaultGasLimit, senderAddress, receiverAddress, goodsDescription, goodsValue)
        console.log(tx.method.toHex());
        console.log(tx.method.hash.toHex());
        return {'callHash':tx.method.hash, 'callData':tx.method.toHex()};
    }

    const cancelTransactionContractCall = async () => {
        const tx = await api.tx.contracts.call(personalShipmentTransactionContract.address, 0, defaultGasLimit, personalShipmentTransactionContract.abi.findMessage('cancel').toU8a([]))
        return {'callHash':tx.method.hash, 'callData':tx.method.toHex()};
    }

    function handleFailedMessages(events) {
        events.filter(({event: {section, method}}) => section === 'system' && method === 'ExtrinsicFailed')
            .forEach(() => {
                console.error("Multisign failed !")
                setSignaturePending(false);
            });
    }

    function handleMultisigCancelledMessages(events, status) {
        events.filter(({event: {section, method}}) => section === 'multisig' && method === 'MultisigCancelled')
            .forEach(() => {
                console.log(`Multisig cancelled in block ${status.asInBlock}`);
                setMultiSigTimePoint(null);
                setSignaturePending(false);
            });
    }

    function handleNewMultisigMessages(events, status) {
        events.filter(({event: {section, method}}) => section === 'multisig' && method === 'NewMultisig')
            .forEach(async (event) => {
                const signedBlock = await api.rpc.chain.getBlock(status.asInBlock);
                let timePointIndex = 0;
                signedBlock.block.extrinsics.forEach((ex, index) => {
                    const { isSigned, meta, method: { args, method, section } } = ex;
                    console.debug(`${section}.${method}(${args.map((a) => a.toString()).join(', ')})`);
                    if (section === 'multisig' && method === 'asMulti'){
                        timePointIndex = index;
                    }
                });
                const timePoint = {height: signedBlock.block.header.number.toNumber(), index: timePointIndex};
                console.log(`New multisig in block ${timePoint.height} / ${timePoint.index}`);
                setMultiSigTimePoint(timePoint);
                setSignaturePending(false);
            });
    }

    function handleContractInstantiatedMessages(events, status) {
        events.filter(({event: {section, method}}) => section === 'contracts' && method === 'Instantiated')
            .forEach(async ({ event: { data, method, section }, phase }) => {
                console.log(`Contract instantiated`);
                const abi = new Abi(metadata);
                const contract = await new ContractPromise(api, abi, data[1].toHuman());
                keyring.saveContract(contract.address.toString(), {
                    contract: {
                        abi: JSON.stringify(abi.json)
                    },
                    name: "Personal Shipment Transaction",
                    tags: ["pst"]
                });
                setPersonalShipmentTransactionContract(contract);
                setSignaturePending(false);
            });
    }

    function handleKilledAccountMessages(events, status) {
        events.filter(({event: {section, method}}) => section === 'system' && method === 'KilledAccount')
            .forEach(async ({ event: { data, method, section }, phase }) => {
                console.log("Killed Account " + data[0].toHuman());
                forgetContract(data[0].toHuman());
            });
    }

    const forgetContract = (contract) => {
        keyring.forgetContract(contract);
        setPersonalShipmentTransactionContract(null);
        setMultiSigTimePoint(null);
        setSender(null);
        setReceiver(null);
        setSignaturePending(false);
    }

    function handleMultisgigExecutedMessages(events, status) {
        events.filter(({event: {section, method}}) => section === 'multisig' && method === 'MultisigExecuted')
            .forEach((event) => {
                console.log(`Multisig executed in block ${status.asInBlock}`);
                setMultiSigTimePoint(null);
            });
    }

    const handleMultisigMessages = async (result) => {
        if ((result.status.isInBlock) && result.events && result.events.length > 0){
            handleFailedMessages(result.events);
            handleMultisigCancelledMessages(result.events, result.status);
            handleNewMultisigMessages(result.events, result.status);
            handleMultisgigExecutedMessages(result.events, result.status);
            handleContractInstantiatedMessages(result.events, result.status);
            handleKilledAccountMessages(result.events, result.status);
        }
    }

    function getMultisigSigners(senderAddress, receiverAddress) {
        const signers = [senderAddress, receiverAddress];
        const otherSigners = signers.filter((signer) => signer !== accountPair.address);
        const multsigAccountName = findAccountNameByAddress(senderAddress) + "And" + findAccountNameByAddress(receiverAddress);
        const multisigKeyring = keyring.addMultisig(signers, signers.length, { name: multsigAccountName});
        const signersAccount = multisigKeyring.pair;
        return {signers, otherSigners, signersAccount};
    }

    const cancelMultiTransfer = async () => {
        const { callHash } =  await deployTransactionContractCall(sender.address, receiver.address);
        const { signers, otherSigners } = getMultisigSigners(sender.address, receiver.address);
        api.tx.multisig.cancelAsMulti(signers.length, otherSigners,multiSigTimePoint,callHash)
            .signAndSend(accountPair, ({status, events}) => {
                handleMultisigMessages(status, events);
            });
    }
    const deployTransactionContractAsMulti = async (senderAddress, receiverAddress) => {
        let { callData } =  await deployTransactionContractCall(senderAddress, receiverAddress);
        const {signers, otherSigners, signersAccount} = getMultisigSigners(senderAddress, receiverAddress);
        const {multiSigTimePoint, firstApproval, pendingCallData} = await retrievePendingNonApprovedTransaction(senderAddress, receiverAddress);
        if (multiSigTimePoint){
            setMultiSigTimePoint(multiSigTimePoint);
        }
        if (pendingCallData){
            // TODO : retrieve values from call data
            callData = pendingCallData;
        }
        if (firstApproval && firstApproval === accountPair.address){
            console.log("Already signed");
            return;
        }

        api.tx.balances.transferKeepAlive(signersAccount.address, TRANSACTION_DEPOSIT_PER_STAKEHOLDER).signAndSend(accountPair, async (result) => {
            if (result.status.isInBlock){
                api.tx.multisig.asMulti(signers.length, otherSigners,multiSigTimePoint,callData, (pendingCallData == null),1000000000000 )
                    .signAndSend(accountPair, async (result) => {
                        handleMultisigMessages(result);
                    });
            }
        });
    }

    const cancelTransactionContract = async () => {
        setSignaturePending(true);
        const { callData } =  await cancelTransactionContractCall();
        const {signers, otherSigners} = getMultisigSigners(sender.address, receiver.address);
        api.tx.multisig.asMulti(signers.length, otherSigners,multiSigTimePoint,callData,false,1000000000000 )
            .signAndSend(accountPair, async (result) => {
                handleMultisigMessages(result);
            });
    }

    const newTransactionContract = async () => {
        setSignaturePending(true);
        setSender(accountPair);
        deployTransactionContractAsMulti(accountPair.address, receiver.address);
    }

    const approveTransactionContract = async () => {
        setSignaturePending(true);
        deployTransactionContractAsMulti(sender.address, receiver.address);
    }

    const updateReceiverPayment = () => {
        personalShipmentTransactionContract && personalShipmentTransactionContract.query.receiverPayment(accountPair.address, 0, defaultGasLimit).then((balance) => {
            if (balance.output) {
                setReceiverPayment(balance.output.toNumber());
            }
        });
    }

    const updateReceiver = () => {
        console.log(personalShipmentTransactionContract);
        personalShipmentTransactionContract && personalShipmentTransactionContract.query.receiver(accountPair.address, 0, defaultGasLimit).then((account) => {
            console.log(account);
            if (account.output) {
                console.log("Receiver", account.output.toHuman());
                setReceiver(findAccountByAddress(account.output.toHuman()));
            }
        });
    }
    const updateSender = () => {
        personalShipmentTransactionContract && personalShipmentTransactionContract.query.sender(accountPair.address, 0, defaultGasLimit).then((account) => {
            console.log(account);
            if (account.output) {
                console.log("Sender", account.output.toHuman());
                setSender(findAccountByAddress(account.output.toHuman()));
            }
        });
    }
    const updateGoodsValue = () => {
        personalShipmentTransactionContract && personalShipmentTransactionContract.query.goodsPrice(accountPair.address, 0, defaultGasLimit).then((price) => {
            if (price.output) {
                setGoodsValue(price.output);
            }
        });
    }

    const updateGoodsDescription = () => {
        personalShipmentTransactionContract && personalShipmentTransactionContract.query.goodsDescription(accountPair.address, 0, defaultGasLimit).then((description) => {
            if (description.output) {
                setGoodsDescription(description.output.toHuman());
            }
        });
    }

    const updateTrackingNumber = () => {
        personalShipmentTransactionContract && personalShipmentTransactionContract.query.trackingNumber(accountPair.address, 0, defaultGasLimit).then((number) => {
            if (number.output && number.output.isSome) {
                setTrackingNumber(number.output.value.toHuman());
            }else{
                setTrackingNumber('');
            }
        });
    }

    const updateStatus = () => {
        personalShipmentTransactionContract && personalShipmentTransactionContract.query.status(accountPair.address, 0, defaultGasLimit).then((status) => {
            if (status.output) {
                setTransactionStatus(status.output.toHuman())
            }
        });
    }

    const updateStatusRefreshing = () => {
        personalShipmentTransactionContract && personalShipmentTransactionContract.query.statusRefreshing(accountPair.address, 0, defaultGasLimit).then((status) => {
            if (status.output) {
                setStatusRefreshing(status.output.isTrue)
            }
        });
    }

    const isSender = () => sender && sender.address === accountPair.address;
    const isReceiver = () => receiver && receiver.address === accountPair.address;

    useEffect(() => {
        personalShipmentTransactionContract && api.query.contracts.contractInfoOf(personalShipmentTransactionContract.address, async (value) => {
            if (value.isSome && value.value.isAlive){
                console.log("Found previous contract ", value.value)
                updateReceiverPayment();
                updateReceiver();
                updateSender();
                updateGoodsValue();
                updateTrackingNumber();
                updateGoodsDescription();
                updateStatus();
                updateStatusRefreshing();
            }else{
                console.log("No contract info")
                forgetContract(personalShipmentTransactionContract.address);
                setStatusRefreshing(false);
            }

        });
    }, [api, personalShipmentTransactionContract]);

    const paymentDescription = () => {
        if (receiver){
            if  (receiverPayment >= goodsValueNumber()) {
                return "Done."
            }else{
                if (isSender()){
                    return "Waiting for " + findAccountNameByAddress(receiver.address) + " payment..."
                }else{
                    return "Please proceed to payment";
                }
            }
        }
        return "Payment due";
    }

    const refreshShippingStatusStep = () => <Step disabled={!trackingNumber}>
        <Icon name='truck' />
        {!trackingNumber && <Step.Content>
            <Step.Title>Shipping</Step.Title>
        </Step.Content>}
        {trackingNumber &&     <Button as='div' labelPosition='right'  onClick={refresh}>
            <Button loading={statusRefreshing} color='green'>
                <Icon name='refresh' />
                Shipping Status
            </Button>
            <Label as='a' basic color='green' pointing='left'>
                {transactionStatus}
            </Label>
        </Button>
        }
    </Step>;

    const cancelTransactionStep = () => <Step>
        <Step.Content>
            <Button color={'red'}
                    onClick={cancelTransactionContract}
                    loading={signaturePending}>
                Cancel Transaction
            </Button>
        </Step.Content>
    </Step>

    const trackingNumberIsSet = () => {
        return typeof(trackingNumber) !== 'undefined' && trackingNumber !== ''
    }

    const contractIsSet = () => {
        return personalShipmentTransactionContract != null
    }

    const goodsValueNumber = () => {
        if (goodsValue && goodsValue.toNumber){
            return goodsValue.toNumber();
        }
        return goodsValue;
    }

    return (
        <Grid.Column>
            <h1>Peer To Peer Shipment Transaction</h1>
            { accountPair && !contractIsSet() && !receiver && <Segment placeholder>
                <Header icon>
                    <Icon name='send' />
                    No transaction found.
                </Header>
                { keyringOptions &&
                    <Dropdown
                        text='Start Transaction With'
                        disabled={contractIsSet()}
                        //labeled floating button
                        selection
                        className='button'
                        placeholder='Select a receiver account'
                        options={keyringOptions}
                        onChange={(_, dropdown) => {
                            onSelectReceiver(dropdown.value);
                        }}
                    />
                }
            </Segment> }




            { accountPair && !contractIsSet() && receiver && sender && <React.Fragment>
                <Segment width={8}>
                    <Form>
                        <Form.Field>
                            <label>Sender</label>
                            <input placeholder='Sender' disabled={true} value={findAccountNameByAddress(sender.address)}/>
                        </Form.Field>
                        <Form.Field>
                            <label>Receiver</label>
                            <input placeholder='Sender' disabled={true} value={findAccountNameByAddress(receiver.address)}/>
                        </Form.Field>
                        <Form.Field>
                            <label>Goods Description</label>
                            <Input placeholder='Goods Description'
                                   onChange={(_, { value }) => setGoodsDescription(value)}
                                   disabled={multiSigTimePoint != null}
                            />
                        </Form.Field>
                        <Form.Field>
                            <label>Goods Value</label>
                            <Input
                                label={{ basic: true, content: 'Unit' }}
                                labelPosition='right'
                                placeholder='Goods value...'
                                onChange={(_, { value }) => setGoodsValue(parseInt(value, 10) * ONE_UNIT)}
                                disabled={multiSigTimePoint != null}
                            />
                        </Form.Field>
                        {sender && receiver && sender.address === accountPair.address && multiSigTimePoint == null && <React.Fragment>
                            <Button type='submit' onClick={newTransactionContract}
                                    disabled={goodsValue === 0 || goodsDescription === ""}
                                    loading={signaturePending}>
                                Start New Transaction
                            </Button>
                            <Button onClick={()=>{ setSender(null);setReceiver(null);}} color={'red'}>Cancel</Button>
                        </React.Fragment>
                        }
                        {sender && receiver && receiver.address === accountPair.address && multiSigTimePoint != null &&
                            <Button onClick={approveTransactionContract} color={'blue'} loading={signaturePending}>
                                Approve the transaction from {findAccountNameByAddress(sender.address)}</Button>
                        }
                    </Form>
                </Segment>
                {sender && receiver && sender.address === accountPair.address && multiSigTimePoint != null && <Message warning attached='bottom'>
                <Icon name='warning' />
                Waiting for {findAccountNameByAddress(receiver.address)} to approve this transaction...
                </Message> }
            </React.Fragment>
            }

            {personalShipmentTransactionContract && sender && receiver && goodsValue && <React.Fragment>
                <Message>
                    <Message.Header>{findAccountNameByAddress(sender.address)} and {findAccountNameByAddress(receiver.address)} Agreement</Message.Header>
                    <Message.List>
                        <Message.Item>{findAccountNameByAddress(receiver.address)} is committed to buy {goodsDescription} from {findAccountNameByAddress(sender.address)}</Message.Item>
                        <Message.Item>{findAccountNameByAddress(sender.address)} is committed to send {goodsDescription} to {findAccountNameByAddress(receiver.address)}</Message.Item>
                        <Message.Item>{findAccountNameByAddress(receiver.address)} is committed to pay {goodsValue.toHuman ? goodsValue.toHuman():goodsValue} to {findAccountNameByAddress(sender.address)}</Message.Item>
                    </Message.List>
                </Message>
                <Step.Group>
                    <Step completed={receiverPayment >= goodsValueNumber()}>
                        <Icon name='payment' />
                        { (isSender() || receiverPayment >= goodsValueNumber()) && <Step.Content>
                            <Step.Title>Payment</Step.Title>
                            <Step.Description>{paymentDescription()}</Step.Description>
                        </Step.Content> }
                        { isReceiver() && receiverPayment < goodsValueNumber() && <Step.Content>
                            <Button color={'green'} onClick={pay}>Pay</Button>
                        </Step.Content> }
                    </Step>

                    <Step completed={trackingNumberIsSet()} disabled={receiverPayment < goodsValueNumber()}>
                        <Icon name='send' />
                        <Step.Content>
                            {(receiverPayment < goodsValueNumber() || trackingNumber) && <Step.Title>Tracking Number</Step.Title>}
                            {!trackingNumber && receiverPayment >= goodsValueNumber() && isReceiver() && sender && <Step.Description>Waiting for {findAccountNameByAddress(sender.address)} to send the parcel.</Step.Description>}
                            {trackingNumber && <Step.Description>#{trackingNumber}</Step.Description>}
                            {isSender() && receiverPayment >= goodsValueNumber() && !trackingNumber && <Input disabled={trackingNumberIsSet()}
                                action={{
                                    color: 'teal',
                                    labelPosition: 'left',
                                    content: 'Set Tracking Number',
                                    icon: 'tag',
                                    onClick: () => { setContractTrackingNumber(); }
                                }}
                                actionPosition='left'
                                placeholder='Tracking Number...'
                                defaultValue={trackingNumber}
                                onChange={ onTrackingNumberChange }

                            />}
                        </Step.Content>
                    </Step>
                    {refreshShippingStatusStep()}
                    {cancelTransactionStep()}
                </Step.Group>
            </React.Fragment>}
        </Grid.Column>
    );
}

export default function PersonalShipmentTransaction(props) {
    const {api} = useSubstrate();
    const {accountPair} = props;
    return (api.registry && accountPair
        ? <Main {...props} /> : null);
}
