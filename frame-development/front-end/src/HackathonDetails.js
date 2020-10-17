import React, { useEffect, useState } from 'react';
import { Form, Input, Grid, Card, Statistic } from 'semantic-ui-react';

import { useSubstrate } from './substrate-lib';
import { TxButton } from './substrate-lib/components';

function Main (props) {
  const { api } = useSubstrate();
  const { accountPair } = props;

  // The transaction submission status
  const [status, setStatus] = useState('');

  // The currently stored value
  const [currentUsername, setCurrentUsername] = useState("");
  const [currentChallengesSubmitted, setCurrentChallengesSubmitted] = useState(0);
  const [currentBounties, setCurrentBounties] = useState(null);
  const [username, setUsername] = useState("");
  const [challengesSubmitted, setChallengesSubmitted] = useState(0);

  const bounties = () => {
    return currentBounties && currentBounties.isSome ? 'Great ! ' + currentBounties.toString() + ' bounties earned :)' :'No bounties.'
  }

  useEffect(() => {
    let unsubscribe;
    console.log(api.query.templateModule);
    api.query.templateModule.details(newValue => {
      // The storage value is an Option<u32>
      // So we have to check whether it is None first
      // There is also unwrapOr
      if (newValue.isNone) {
        setCurrentChallengesSubmitted('0');
        setCurrentUsername('<None>')
      } else {
        console.log(newValue)
        console.log(newValue.BountiesPrize.isSome)
        setCurrentBounties(newValue.BountiesPrize);
        setCurrentChallengesSubmitted(newValue.ChallengesSubmitted.toString());
        setCurrentUsername(newValue.Username.toHuman())
      }
    }).then(unsub => {
      unsubscribe = unsub;
    })
      .catch(console.error);

    return () => unsubscribe && unsubscribe();
  }, [api.query.templateModule]);

  return (
    <Grid.Column width={8}>
      <h1>Hackathon Details</h1>
      <Card>
        <Card.Content>
          <Card.Header content={currentUsername} />
          <Card.Meta content={currentChallengesSubmitted + ' challenges submitted.'} />
          <Card.Description content={bounties()} />
        </Card.Content>
      </Card>
      <Form>
        <Form.Field>
          <Input
            label='Username'
            state='newValue'
            type='string'
            onChange={(_, { value }) => setUsername(value)}
          />
        </Form.Field>
        <Form.Field>
          <Input
              label='# Challenges'
              state='newValue'
              type='number'
              onChange={(_, { value }) => setChallengesSubmitted(value)}
          />
        </Form.Field>
        <Form.Field style={{ textAlign: 'center' }}>
          <TxButton
            accountPair={accountPair}
            label='Update Details'
            type='SIGNED-TX'
            setStatus={setStatus}
            attrs={{
              palletRpc: 'templateModule',
              callable: 'updateHackathonDetails',
              inputParams: [{"Username": username, "ChallengesSubmitted": challengesSubmitted, "BountiesPrize": null} ],
              paramFields: [true]
            }}
          />
        </Form.Field>
        <div style={{ overflowWrap: 'break-word' }}>{status}</div>
      </Form>
    </Grid.Column>
  );
}

export default function HackathonDetails (props) {
  const { api } = useSubstrate();
  return (api.query.templateModule && api.query.templateModule.something
    ? <Main {...props} /> : null);
}
