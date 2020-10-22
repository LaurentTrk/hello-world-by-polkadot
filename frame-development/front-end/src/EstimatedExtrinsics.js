import React, {useEffect, useState} from 'react';
import {Grid, Form, Dropdown, Input, Label, Icon} from 'semantic-ui-react';
import {Button, Header, Modal, Table} from 'semantic-ui-react'

import {useSubstrate} from './substrate-lib';
import {
    EstimatedSignedTxButton
} from "./substrate-lib/components/EstimatedSignedTxButton";
import {allParamsFilled} from "./substrate-lib/Transactions";

const argIsOptional = (arg) =>
    arg.type.toString().startsWith('Option<');

function Main(props) {
    const {api} = useSubstrate();
    const {accountPair} = props;
    const [status, setStatus] = useState(null);
    const [estimate, setEstimate] = useState(null);

    const [palletRPCs, setPalletRPCs] = useState([]);
    const [callables, setCallables] = useState([]);
    const [paramFields, setParamFields] = useState([]);

    const initFormState = {
        palletRpc: '',
        callable: '',
        inputParams: []
    };

    const [formState, setFormState] = useState(initFormState);
    const {palletRpc, callable, inputParams} = formState;

    const getApiType = (api) => {
        return api.tx;
    };

    const updatePalletRPCs = () => {
        if (!api) {
            return;
        }
        const apiType = getApiType(api);
        const palletRPCs = Object.keys(apiType).sort()
            .filter(pr => Object.keys(apiType[pr]).length > 0)
            .map(pr => ({key: pr, value: pr, text: pr}));
        setPalletRPCs(palletRPCs);
    };

    const updateCallables = () => {
        if (!api || palletRpc === '') {
            return;
        }
        const callables = Object.keys(getApiType(api)[palletRpc]).sort()
            .map(c => ({key: c, value: c, text: c}));
        setCallables(callables);
    };

    const updateParamFields = () => {
        if (!api || palletRpc === '' || callable === '') {
            setParamFields([]);
            return;
        }

        let paramFields = [];
        const metaArgs = api.tx[palletRpc][callable].meta.args;
        console.log(metaArgs);
        if (metaArgs && metaArgs.length > 0) {
            paramFields = metaArgs.map(arg => ({
                name: arg.name.toString(),
                type: arg.type.toString(),
                optional: argIsOptional(arg)
            }));
        }

        setParamFields(paramFields);
    };

    useEffect(updatePalletRPCs, [api]);
    useEffect(updateCallables, [api, palletRpc]);
    useEffect(updateParamFields, [api, palletRpc, callable]);

    const onPalletCallableParamChange = (_, data) => {
        setFormState(formState => {
            let res;
            const {state, value} = data;
            if (typeof state === 'object') {
                // Input parameter updated
                const {ind, paramField: {type}} = state;
                const inputParams = [...formState.inputParams];
                inputParams[ind] = {type, value};
                res = {...formState, inputParams};
            } else if (state === 'palletRpc') {
                res = {...formState, [state]: value, callable: '', inputParams: []};
            } else if (state === 'callable') {
                res = {...formState, [state]: value, inputParams: []};
            }
            return res;
        });
    };

    const getOptionalMsg = () => 'Leaving this field as blank will submit a NONE value';

    return (
        <Grid.Column width={8}>
            <h1>Signed Transactions</h1>
            <Form.Field>
                <Label basic color='teal'>
                    <Icon name='hand point right'/>
                    1 DOT = 10000000000
                </Label>
            </Form.Field>
            <Header as='h4'>Select the transaction you want to submit.</Header>
            <Form>
                <Form.Field>
                    <Dropdown
                        placeholder='Pallets'
                        fluid
                        label='Pallet'
                        onChange={onPalletCallableParamChange}
                        search
                        selection
                        state='palletRpc'
                        value={palletRpc}
                        options={palletRPCs}
                    />
                </Form.Field>
                <Form.Field>
                    <Dropdown
                        placeholder='Callables'
                        fluid
                        label='Callable'
                        onChange={onPalletCallableParamChange}
                        search
                        selection
                        state='callable'
                        value={callable}
                        options={callables}
                    />
                </Form.Field>
                {paramFields.map((paramField, ind) =>
                    <Form.Field key={`${paramField.name}-${paramField.type}`}>
                        <Input
                            placeholder={paramField.type}
                            fluid
                            type='text'
                            label={paramField.name}
                            state={{ind, paramField}}
                            value={inputParams[ind] ? inputParams[ind].value : ''}
                            onChange={onPalletCallableParamChange}
                        />
                        {paramField.optional
                            ? <Label
                                basic
                                pointing
                                color='teal'
                                content={getOptionalMsg()}
                            />
                            : null
                        }
                    </Form.Field>
                )}
                <Form.Field style={{textAlign: 'center'}}>
                    <SubmissionModal accountPair={accountPair}
                                     setStatus={setStatus}
                                     setEstimate={setEstimate}
                                     status={status}
                                     estimate={estimate}
                                     attrs={{palletRpc, callable, inputParams, paramFields}}/>
                    <Header as='h5'>You will be able to verify the transaction before submission.</Header>
                </Form.Field>
                <div style={{overflowWrap: 'break-word'}}>{status}</div>
            </Form>
        </Grid.Column>
    );
}

function SubmissionModal(props) {
    const [open, setOpen] = React.useState(false)
    const {status, estimate, setEstimate, setStatus, accountPair} = props;
    const {palletRpc, callable, inputParams, paramFields} = props.attrs;

    const close = () => {
        setOpen(false);
        setEstimate(null);
    }

    return (
        <Modal
            onClose={close}
            onOpen={() => {
                setStatus('');
                setOpen(true)
            }}
            open={open}
            trigger={<Button
                color={'blue'}
                style={null}
                basic type='submit'
                disabled={!palletRpc || !callable || !allParamsFilled(paramFields, inputParams)}
            >Submit Transaction</Button>}
        >
            <Modal.Header>Submit Transaction</Modal.Header>
            <Modal.Content>
                <Modal.Description>
                    <p/>
                    <Table celled striped>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell colSpan='2'>Sending
                                    transaction <b>{palletRpc}.{callable}()</b></Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            <Table.Row>
                                <Table.Cell>using account</Table.Cell>
                                <Table.Cell>{accountPair ? keyring.encodeAddress(accountPair.publicKey, 0) : ''}</Table.Cell>
                            </Table.Row>
                            {paramFields.map((paramField, ind) =>
                                <Table.Row>
                                    <Table.Cell>{paramField.name}</Table.Cell>
                                    <Table.Cell>{inputParams[ind] ? inputParams[ind].value : ''}</Table.Cell>
                                </Table.Row>)}
                        </Table.Body>
                    </Table>
                    <p>{status}</p>
                    <Label color={'red'}><Icon name='warning sign'/>You are connected to the Polkadot (live) chain, some
                        of your DOTs will be spent if you submit this transaction.</Label>
                </Modal.Description>
            </Modal.Content>
            <Modal.Actions>
                <Button.Group>
                    {!estimate &&
                    <React.Fragment>
                        <EstimatedSignedTxButton
                            label='Estimate fees'
                            type='ESTIMATE-TX'
                            color='green'
                            {...props}
                        />
                        <Button.Or/>
                        <EstimatedSignedTxButton
                            label='Submit without estimate'
                            type='SIGNED-TX'
                            color='blue'
                            onSubmit={close}
                            {...props}
                        />
                    </React.Fragment>}
                    {estimate &&
                    <EstimatedSignedTxButton
                        label={'Submit with ' + estimate + ' fees'}
                        type='SIGNED-TX'
                        color='blue'
                        onSubmit={close}
                        {...props}
                    />
                    }
                    <Button.Or/>
                    <Button onClick={close} basic color={"grey"}>Cancel submission</Button>
                </Button.Group>
            </Modal.Actions>
        </Modal>
    )
}

export default function EstimatedExtrinsics(props) {
    const {api} = useSubstrate();
    return api.tx ? <Main {...props} /> : null;
}
