import React, {useEffect, useState} from 'react';
import {Button, Card, Divider, Dropdown, Form, Grid, Rating, Statistic} from 'semantic-ui-react';

import {useSubstrate} from './substrate-lib';
import CharityRaffleContract, {createCharityRaffleContract, defaultGasLimit} from "./CharityRaffleContract";


function Main(props) {
    const {api, keyring} = useSubstrate();
    const {accountPair} = props;

    const findAccountNameByAddress = (accountAddress) => {
        const accounts = keyring.getPairs();
        let accountName = accountAddress;
        accounts.forEach(({address, meta, publicKey}) => {
            if (address === accountAddress) {
                accountName = meta.name;
            }
        });
        return accountName;
    }

    const keyringOptions = keyring.getPairs().map(account => ({
        key: account.address,
        value: account,
        text: account.meta.name.toUpperCase(),
        icon: 'user'
    }));

    const [charityRaffleContract, setCharityRaffleContract] = useState(CharityRaffleContract(api));
    const [charityPotBalance, setCharityPotBalance] = useState(0);
    const [isStarted, setIsStarted] = useState(false);
    const [isClosed, setIsClosed] = useState(false);
    const [players, setPlayers] = useState(0);
    const [firstWinner, setFirstWinner] = useState('');
    const [secondWinner, setSecondWinner] = useState('');
    const [amount, setAmount] = useState(10);
    const [charityAccount, setCharityAccount] = useState(null);
    const [raffleCharityAccount, setRaffleCharityAccount] = useState('');
    const [multiSigTimePoint, setMultiSigTimePoint] = useState(null);

    const onRate = (_, data) => setAmount(data.rating);
    const onSelectCharityAccount = address => setCharityAccount(address);

    const play = () => {
        charityRaffleContract.tx.play(10000000000000 * amount, defaultGasLimit).signAndSend(accountPair, () => {
        });
    }

    const draw = () => {
        charityRaffleContract.tx.draw(0, defaultGasLimit).signAndSend(accountPair, () => {
        });
    }

    const transferTransaction = async () => {
        const tx = await api.tx.balances.transfer(charityAccount.address, charityPotBalance * 1000000000000000);
        return {'callHash':tx.method.hash, 'callData':tx.method.toHex()};
    }

    function handleFailedMessages(events) {
        events.filter(({event: {section, method}}) => section === 'system' && method === 'ExtrinsicFailed')
            .forEach(() => {
                console.log("Multisign failed !")
            });
    }

    function handleMultisigCancelledMessages(events, status) {
        events.filter(({event: {section, method}}) => section === 'multisig' && method === 'MultisigCancelled')
            .forEach(() => {
                console.log(`Multisig cancelled in block ${status.asInBlock}`);
                setMultiSigTimePoint(null);
            });
    }

    function handleNewMultisigMessages(events, status) {
        events.filter(({event: {section, method}}) => section === 'multisig' && method === 'NewMultisig')
            .forEach(async (event) => {
                const signedBlock = await api.rpc.chain.getBlock(status.asInBlock);
                let timePointIndex = 0;
                signedBlock.block.extrinsics.forEach((ex, index) => {
                    const { isSigned, meta, method: { args, method, section } } = ex;
                    console.log(`${section}.${method}(${args.map((a) => a.toString()).join(', ')})`);
                    if (section === 'multisig' && method === 'asMulti'){
                        timePointIndex = index;
                    }
                });
                const timePoint = {height: signedBlock.block.header.number.toNumber(), index: timePointIndex};
                console.log(`New multisig in block ${timePoint.height} / ${timePoint.index}`);
                setMultiSigTimePoint(timePoint);
            });
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
        }
    }

    function getMultisigSigners() {
        const signers = [firstWinner, secondWinner];
        const otherSigners = signers.filter((signer) => signer !== accountPair.address);
        return {signers, otherSigners};
    }

    const cancelMultiTransfer = async () => {
        const { callHash } =  await transferTransaction();
        const { signers, otherSigners } = getMultisigSigners();
        api.tx.multisig.cancelAsMulti(signers.length, otherSigners,multiSigTimePoint,callHash)
            .signAndSend(accountPair, ({status, events}) => {
                handleMultisigMessages(status, events);
            });
    }
    const transferAsMulti = async () => {
        const { callData } =  await transferTransaction();
        const {signers, otherSigners} = getMultisigSigners();
        api.tx.multisig.asMulti(signers.length, otherSigners,multiSigTimePoint,callData,false,10000000000 )
            .signAndSend(accountPair, async (result) => {
                handleMultisigMessages(result);
            });
    }

    const newRaffle = async () => {
        createCharityRaffleContract(api, accountPair, (contractPromise) => {
            const previousContract = charityRaffleContract;
            setCharityRaffleContract(contractPromise);
            if (previousContract) {
                charityRaffleContract.tx.terminate(0, defaultGasLimit).signAndSend(accountPair, (result) => {
                });
            }
        });
    }

    const updateCharityPotBalance = () => {
        charityRaffleContract && charityRaffleContract.query.charityPotBalance(keyring.getPairs()[0].address, 0, defaultGasLimit).then((balance) => {
            if (balance.output) {
                setCharityPotBalance(balance.output.toNumber() / 1000000000000000);
            }
        });
    }

    const updateIsClosed = () => {
        charityRaffleContract && charityRaffleContract.query.isClosed(keyring.getPairs()[0].address, 0, defaultGasLimit).then((closed) => {
            if (closed.output) {
                setIsClosed(closed.output.isTrue);
            }
        });
    }

    const updateIsStarted = () => {
        charityRaffleContract && charityRaffleContract.query.isStarted(keyring.getPairs()[0].address, 0, defaultGasLimit).then((started) => {
            if (started.output) {
                setIsStarted(started.output.isTrue);
            }
        });
    }

    const updatePlayers = () => {
        charityRaffleContract && charityRaffleContract.query.playersNumber(keyring.getPairs()[0].address, 0, defaultGasLimit).then((playersNumber) => {
            if (playersNumber.output) {
                setPlayers(playersNumber.output.toNumber());
            }
        });
    }

    const updateWinners = () => {
        charityRaffleContract && charityRaffleContract.query.winners(keyring.getPairs()[0].address, 0, defaultGasLimit).then((winners) => {
            if (winners.output) {
                const the_winners = winners.output.toArray();
                if (the_winners[0].isSome) {
                    setFirstWinner(the_winners[0].value.toHuman());
                } else {
                    setFirstWinner('');
                }
                if (the_winners[1].isSome) {
                    setSecondWinner(the_winners[1].value.toHuman());
                } else {
                    setSecondWinner('');
                }
            }
        });
    }

    useEffect(() => {
        charityRaffleContract && api.query.contracts.contractInfoOf(charityRaffleContract.address, async () => {
            updateCharityPotBalance();
            updateWinners();
            updateIsClosed();
            updateIsStarted();
            updatePlayers();
        });
    }, [api, charityRaffleContract]);

    return (
        <Grid.Column>
            <h1>Charity Raffle</h1>
            <Form>
                <Form.Group inline>
                    <Form.Field style={{textAlign: 'center'}}>
                        <Button onClick={newRaffle} disabled={charityRaffleContract && !isClosed} color={'blue'}>New
                            Raffle</Button>
                    </Form.Field>
                </Form.Group>
            </Form>
            {charityRaffleContract && <React.Fragment>
                <Card.Group>
                    <Card>
                        <Statistic value={charityPotBalance} label={raffleCharityAccount + ' Charity Pot'}/>
                    </Card>
                    <Card>
                        <Statistic value={players} label={'Players'}/>
                    </Card>
                </Card.Group>
                <Card.Group>
                    {firstWinner && <Card>
                        <Statistic value={findAccountNameByAddress(firstWinner)} label={'won a Polkadot t-shirt !'}/>
                    </Card>}
                    {secondWinner && <Card>
                        <Statistic value={findAccountNameByAddress(secondWinner)} label={'won a Kusama t-shirt !'}/>
                    </Card>}
                </Card.Group>
                <Divider hidden/>
                {!isClosed && <Form>
                    <Form.Group inline>
                        <Form.Field>
                            <Rating icon='heart' disabled={isClosed} maxRating={10} rating={amount} onRate={onRate}/>
                        </Form.Field>
                        <Form.Field style={{textAlign: 'center'}}>
                            <Button onClick={play} disabled={isClosed}>Give some love to {raffleCharityAccount}</Button>
                            <Button onClick={draw} disabled={!isStarted || isClosed}>Try your luck</Button>
                        </Form.Field>
                    </Form.Group>
                </Form>}
                {isClosed && <Form>
                    <h3 color={'green'}>{findAccountNameByAddress(firstWinner)} and {findAccountNameByAddress(secondWinner)} won {charityPotBalance} tokens ! Congrats. </h3>
                    <h3 color={'green'}>They need to choose and approve the transfer of these tokens to another account. </h3>
                    <Form.Group inline>
                        <Form.Field style={{textAlign: 'center'}}>
                            <Button onClick={transferAsMulti} color={'blue'}>{multiSigTimePoint ? 'Approve transfer to':'Transfer to'} </Button>
                            <Dropdown
                                disabled={multiSigTimePoint}
                                search
                                selection
                                clearable
                                placeholder='Select another account'
                                options={keyringOptions}
                                onChange={(_, dropdown) => {
                                    onSelectCharityAccount(dropdown.value);
                                }}
                            />
                            <Button onClick={cancelMultiTransfer} disabled={!multiSigTimePoint} color={'blue'}>Cancel Transfer</Button>
                        </Form.Field>
                    </Form.Group>
                </Form>}
            </React.Fragment>}
        </Grid.Column>
    );
}

export default function CharityRaffle(props) {
    const {api} = useSubstrate();
    const {accountPair} = props;
    return (api.registry && accountPair
        ? <Main {...props} /> : null);
}
