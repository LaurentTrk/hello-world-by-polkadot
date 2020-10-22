import React, { useEffect, useState } from 'react';
import {Table, Grid, Button, Label, Icon, Menu} from 'semantic-ui-react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { useSubstrate } from './substrate-lib';

export default function Main (props) {
  const { api, keyring } = useSubstrate();
  const accounts = keyring.getPairs();
  const [balances, setBalances] = useState({});

  useEffect(() => {
    const addresses = keyring.getPairs().map(account => account.address);
    let unsubscribeAll = null;

    api.query.system.account
      .multi(addresses, balances => {
        const balancesMap = addresses.reduce((acc, address, index) => ({
          ...acc, [address]: balances[index].data.free.toHuman()
        }), {});
        setBalances(balancesMap);
      }).then(unsub => {
        unsubscribeAll = unsub;
      }).catch(console.error);

    return () => unsubscribeAll && unsubscribeAll();
  }, [api, keyring, setBalances]);

  return (
    <Grid.Column>
      <h1>Balances</h1>
      <Label color={'red'}><Icon name='warning sign' />You are connected to the Polkadot (live) chain, this is real DOTs !</Label>
      <Table celled striped size='small'>
        <Table.Body>{accounts.map(account =>
          <Table.Row key={account.address}>
            <Table.Cell width={3} textAlign='right'>{account.meta.name}</Table.Cell>
            <Table.Cell width={10}>
              <span style={{ display: 'inline-block', minWidth: '31em' }}>
                {keyring.encodeAddress(account.publicKey, 0)}
              </span>
              <CopyToClipboard text={keyring.encodeAddress(account.publicKey, 0)}>
                <Button
                  basic
                  circular
                  compact
                  size='mini'
                  color='blue'
                  icon='copy outline'
                />
              </CopyToClipboard>
            </Table.Cell>
            <Table.Cell width={3}>{
              balances && balances[account.address] &&
              balances[account.address]
            }</Table.Cell>
          </Table.Row>
        )}
        </Table.Body>
      </Table>
    </Grid.Column>
  );
}
