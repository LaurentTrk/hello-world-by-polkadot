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
            ;
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

    const onRate = (_, data) => setAmount(data.rating);
    const onSelectCharityAccount = address => setCharityAccount(address);

    const play = () => {
        charityRaffleContract.tx.play(10000000000000 * amount, defaultGasLimit).signAndSend(accountPair, (result) => {
        });
    }

    const draw = () => {
        charityRaffleContract.tx.draw(0, defaultGasLimit).signAndSend(accountPair, (result) => {
        });
    }

    const newRaffle = async () => {
        charityAccount && createCharityRaffleContract(api, accountPair, charityAccount, (contractPromise) => {
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

    const updateRaffleCharityAccount = () => {
        charityRaffleContract && charityRaffleContract.query.charityPot(keyring.getPairs()[0].address, 0, defaultGasLimit).then((account) => {
            if (account.output) {
                setRaffleCharityAccount(findAccountNameByAddress(account.output.toHuman()));
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
                    setFirstWinner(findAccountNameByAddress(the_winners[0].value.toHuman()));
                } else {
                    setFirstWinner('');
                }
                if (the_winners[1].isSome) {
                    setSecondWinner(findAccountNameByAddress(the_winners[1].value.toHuman()));
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
            updateRaffleCharityAccount();
        });
    }, [api, charityRaffleContract]);

    return (
        <Grid.Column>
            <h1>Charity Raffle</h1>
            <Form>
                <Form.Group inline>
                    <Form.Field style={{textAlign: 'center'}}>
                        <Button onClick={newRaffle} disabled={charityRaffleContract && !isClosed} color={'blue'}>New
                            Raffle For</Button>
                        <Dropdown
                            disabled={charityRaffleContract && !isClosed}
                            search
                            selection
                            clearable
                            placeholder='Select a charity account'
                            options={keyringOptions}
                            onChange={(_, dropdown) => {
                                onSelectCharityAccount(dropdown.value);
                            }}
                        />
                    </Form.Field>
                </Form.Group>
            </Form>
            {charityRaffleContract && <React.Fragment>
                {!isClosed && <h3 color={'blue'}>You are playing for {raffleCharityAccount} charity.</h3>}
                {isClosed &&
                <h3 color={'green'}>This raffle is closed. {raffleCharityAccount} thanks all the players ! </h3>}
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
                        <Statistic value={firstWinner} label={'won a Polkadot t-shirt !'}/>
                    </Card>}
                    {secondWinner && <Card>
                        <Statistic value={secondWinner} label={'won a Kusama t-shirt !'}/>
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
