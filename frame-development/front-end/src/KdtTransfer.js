import React, {useEffect, useState} from 'react';
import {Button, Card, Divider, Dropdown, Form, Grid, Input, Statistic} from 'semantic-ui-react';

import {useSubstrate} from './substrate-lib';
import KdtContract, {defaultGasLimit} from "./KdtContract";


function Main(props) {
    const {api, keyring} = useSubstrate();
    const {accountPair} = props;
    const kdtContract = KdtContract(api);

    const keyringOptions = keyring.getPairs().map(account => ({
        key: account.address,
        value: account.address,
        text: account.meta.name.toUpperCase(),
        icon: 'user'
    }));

    const [totalSupply, setTotalSupply] = useState(0);
    const [balance, setBalance] = useState(0);
    const [formState, setFormState] = useState({addressTo: null, amount: 0});
    const onChange = (_, data) =>
        setFormState(prev => ({...prev, [data.state]: data.value}));

    const {addressTo, amount} = formState;

    const onSelectAddressTo = address => setFormState(prev => ({...prev, 'addressTo': address}));

    const transfer = () => {
        kdtContract.tx.transfer(0, defaultGasLimit, addressTo, amount).signAndSend(accountPair, (result) => {
            updateBalance();
        });
    }

    const updateBalance = () => {
        kdtContract.query.balanceOf(accountPair.address, 0, defaultGasLimit, accountPair.address).then((balance) => {
            setBalance(balance.output.toNumber());
        })
    }
    useEffect(() => {
        let unsubscribe;
        kdtContract.query.totalSupply(keyring.getPairs()[0].address, 0, defaultGasLimit).then((total) => {
            setTotalSupply(total.output.toNumber());
            updateBalance();
        }).then(unsub => {
            unsubscribe = unsub;
        }).catch(console.error);
        return () => unsubscribe && unsubscribe();
    }, [accountPair]);

    return (
        <Grid.Column>
            <h1>Transfer KDT</h1>
            <Card.Group>
                <Card>
                    <Statistic value={totalSupply} label={'Total KDT'}/>
                </Card>
                <Card>
                    <Statistic value={balance} label={'KDT in your wallet'}/>
                </Card>
            </Card.Group>
            <Divider hidden/>
            <Form>
                <Form.Group inline>
                    <Form.Field>
                        <Dropdown
                            search
                            selection
                            clearable
                            placeholder='Select an account'
                            options={keyringOptions}
                            onChange={(_, dropdown) => {
                                onSelectAddressTo(dropdown.value);
                            }}
                        />
                    </Form.Field>
                    <Form.Field width={4}>
                        <Input
                            fluid
                            label='Amount'
                            type='number'
                            state='amount'
                            onChange={onChange}
                        />
                    </Form.Field>
                    <Form.Field style={{textAlign: 'center'}}>
                        <Button onClick={transfer}>Transfer</Button>
                    </Form.Field>
                </Form.Group>
            </Form>
        </Grid.Column>
    );
}

export default function KdtTransfer(props) {
    const {api} = useSubstrate();
    const {accountPair} = props;
    return (api.registry && accountPair
        ? <Main {...props} /> : null);
}
