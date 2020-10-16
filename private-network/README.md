## Generating keys

```shell script
docker run --rm parity/subkey generate --scheme sr25519
Secret phrase `slender stomach chaos hero that luggage puzzle praise tell skill tackle dash` is account:
  Secret seed:      0x0cc48803f2eec86e69a32196b8668ee6b30ba93c40add6bb1cf141a9ea4dc3d3
  Public key (hex): 0x0e4554b51a15c40eed82177aa1b46b0218104e47a4632091acb6bad76b9bc746
  Account ID:       0x0e4554b51a15c40eed82177aa1b46b0218104e47a4632091acb6bad76b9bc746
  SS58 Address:     5CPR86SFMe3ZigFJisC1NVuuV3FvEnRQwb12RnVQEQLeqEDU

docker run --rm parity/subkey inspect --scheme ed25519 "slender stomach chaos hero that luggage puzzle praise tell skill tackle dash"
Secret phrase `slender stomach chaos hero that luggage puzzle praise tell skill tackle dash` is account:
  Secret seed:      0x0cc48803f2eec86e69a32196b8668ee6b30ba93c40add6bb1cf141a9ea4dc3d3
  Public key (hex): 0xe03f38e5eb473a5dddc20540fd673cfde592416810da545188cb4027f50e8cc4
  Account ID:       0xe03f38e5eb473a5dddc20540fd673cfde592416810da545188cb4027f50e8cc4
  SS58 Address:     5H8jN5egdyX9eHNqpU3JgSgC6sR57VMHyvGy1DnKnPHGMkLr

docker run --rm parity/subkey generate --scheme sr25519
Secret phrase `spell butter coin meat suspect lunch raw erode brief mean panic produce` is account:
  Secret seed:      0x45c95a350b6cb57a2566349675f18c7e56c150a5f96a94064fdeb74c46a2c2f4
  Public key (hex): 0x64922a2f2d89332a576b40797e92c2b256d58cfb3387b9535db7c2baf3028727
  Account ID:       0x64922a2f2d89332a576b40797e92c2b256d58cfb3387b9535db7c2baf3028727
  SS58 Address:     5ELa4m4wZmjtxv9ckBrpzTRHx6ubojLvSreD1Cj1PcVx9hS4

docker run --rm parity/subkey inspect --scheme ed25519 "spell butter coin meat suspect lunch raw erode brief mean panic produce"
Secret phrase `spell butter coin meat suspect lunch raw erode brief mean panic produce` is account:
  Secret seed:      0x45c95a350b6cb57a2566349675f18c7e56c150a5f96a94064fdeb74c46a2c2f4
  Public key (hex): 0x9e854d7bdf67a25631d4ebdcb3f1c88d34c6d3c7996dde541ae89b43b5b93de8
  Account ID:       0x9e854d7bdf67a25631d4ebdcb3f1c88d34c6d3c7996dde541ae89b43b5b93de8
  SS58 Address:     5FeZ2EdHmxWFNb6WF7FaTYNXzBS7sHhv3ELwUTtnBiQcPDeK


```

## Running nodes
```shell script
./target/release/node-template   --base-path /tmp/node01   --chain ./customSpecRaw.json   --port 30333   --ws-port 9944   --rpc-port 9933   --telemetry-url 'wss://telemetry.polkadot.io/submit/ 0'   --validator   --rpc-methods=Unsafe   --name MyNode01
./target/release/node-template   --base-path /tmp/node02   --chain ./customSpecRaw.json   --port 30334   --ws-port 9945   --rpc-port 9934   --telemetry-url 'wss://telemetry.polkadot.io/submit/ 0'   --validator   --rpc-methods=Unsafe   --name MyNode02   --bootnodes /ip4/127.0.0.1/tcp/30333/p2p/12D3KooWDATwFvwyEnFFdDEqCumE9aDNdm8GMTgJonhXwhARbkvy
```
