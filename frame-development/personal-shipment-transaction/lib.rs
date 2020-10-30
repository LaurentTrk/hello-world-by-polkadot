#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

#[ink::contract]
mod personal_shipment_transaction {
    #[cfg(not(feature = "ink-as-dependency"))]
    use ink_prelude::vec::Vec;
    use scale::Encode;

    /// The callback selector must match the selector set on the callback function
        /// This value is used when the substrate adapter call back this contract
    const CALLBACK_SELECTOR: &str = "back";

    // /// Errors that can occur upon calling this contract.
    // #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    // #[cfg_attr(feature = "std", derive(::scale_info::TypeInfo))]
    // pub enum TransactionStatus {
    //     Initiated,
    //     ReceiverPaymentReceived,
    //     GoodsSent,
    // }
    const TRANSACTION_INITIATED: u8 = 0;
    const RECEIVER_PAYMENT_RECEIVED: u8 = 1;
    const GOODS_SENT: u8 = 2;

    #[ink(storage)]
    pub struct PersonalShipmentTransaction {
        sender: AccountId,
        receiver: AccountId,
        goods_description: Vec<u8>,
        goods_price: Balance,
        status: u8,

        receiver_payment: Option<Balance>,
        tracking_number: Option<Vec<u8>>,
    }

    /// Errors that can occur upon calling this contract.
    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(::scale_info::TypeInfo))]
    pub enum Error {
        /// The callback has been called by a wrong operator account
        WrongOperator,
        /// Fee provided does not match minimum required fee
        InsufficientFee,
    }

    pub type Result<T> = core::result::Result<T, Error>;

    #[ink(event)]
    /// Initiating a new Oracle Request
    /// This event will be catch by the Chainlink External Initiator
    pub struct OracleRequest {
        #[ink(topic)]
        operator: AccountId,
        spec_index: Vec<u8>,
        request_identifier: u64,
        who: AccountId,
        data_version: u64,
        bytes: Vec<u8>,
        function: Vec<u8>,
        fee: u32,
    }

    impl PersonalShipmentTransaction {
        #[ink(constructor)]
        pub fn new(sender: AccountId, receiver: AccountId, goods_description: Vec<u8>, goods_price: Balance) -> Self {
            Self { sender, receiver, goods_description, goods_price, status: TRANSACTION_INITIATED, receiver_payment: None, tracking_number: None }
        }

        #[ink(message)]
        pub fn status(&self) -> u8 {
            self.status
        }

        #[ink(message)]
        pub fn sender(&self) -> AccountId {
            self.sender
        }

        #[ink(message)]
        pub fn receiver(&self) -> AccountId {
            self.receiver
        }

        #[ink(message)]
        pub fn goods_description(&self) -> Vec<u8> {
            self.goods_description.clone()
        }

        #[ink(message)]
        pub fn goods_price(&self) -> Balance {
            self.goods_price
        }

        #[ink(message)]
        pub fn receiver_payment(&self) -> Option<Balance> {
            self.receiver_payment
        }

        #[ink(message)]
        pub fn tracking_number(&self) -> Option<Vec<u8>> {
            self.tracking_number.clone()
        }

        #[ink(message, payable)]
        pub fn pay(&mut self) -> Result<()> {
            let caller = self.env().caller();
            if caller != self.receiver {
                ink_env::debug_println("Callback called by wrong operator.");
                return Err(Error::WrongOperator);
            }
            self.receiver_payment = Some(self.env().transferred_balance());
            self.status = RECEIVER_PAYMENT_RECEIVED;
            Ok(())
        }

        #[ink(message)]
        pub fn set_tracking_number(&mut self, tracking_number: Vec<u8>) -> Result<()> {
            let caller = self.env().caller();
            if caller != self.sender {
                ink_env::debug_println("Callback called by wrong operator.");
                return Err(Error::WrongOperator);
            }
            if self.status != RECEIVER_PAYMENT_RECEIVED {
                ink_env::debug_println("Callback called by wrong operator.");
                return Err(Error::WrongOperator);
            }
            self.tracking_number = Some(tracking_number);
            self.status = GOODS_SENT;
            Ok(())
        }

        #[ink(message)]
        pub fn update_shipment_status(&mut self) -> Result<()> {
            Ok(())
        }

        #[ink(message, selector = "0x6261636B")]
        pub fn set_shipment_status(&mut self, value: u128) -> Result<()> {
            // let caller = self.env().caller();
            // if caller != self.operator {
            //     ink_env::debug_println("Callback called by wrong operator.");
            //     return Err(Error::WrongOperator);
            // }
            // self.latest_price = value;
            Ok(())
        }
    }

    /// Unit tests.t
    #[cfg(test)]
    mod tests {
        use ::ink_env::{
            call::{build_call, ExecutionInput, Selector},
            DefaultEnvironment,
            Environment,
        };
        use ink_lang as ink;

        /// Imports all the definitions from the outer scope so we can use them here.
        use super::*;

        const DEFAULT_CALLEE_HASH: [u8; 32] = [0x07; 32];
        const DEFAULT_GAS_LIMIT: Balance = 1_000_000;
        const MAXIMUM_BET: u128 = 100_000_000_000_000;

        #[ink::test]
        fn new_works() {
            let mut price_feed = ChainlinkPriceFeed::new();
            price_feed.set_value(70);
        }

        fn default_accounts() -> ink_env::test::DefaultAccounts<ink_env::DefaultEnvironment> {
            ink_env::test::default_accounts::<ink_env::DefaultEnvironment>()
                .expect("off-chain environment should have been initialized already")
        }

        fn set_next_caller(caller: AccountId, endowment: Option<Balance>) {
            ink_env::test::push_execution_context::<ink_env::DefaultEnvironment>(
                caller,
                AccountId::from(DEFAULT_CALLEE_HASH),
                DEFAULT_GAS_LIMIT,
                endowment.unwrap_or(MAXIMUM_BET),
                ink_env::test::CallData::new(ink_env::call::Selector::new([0x00; 4])),
            )
        }
    }
}
