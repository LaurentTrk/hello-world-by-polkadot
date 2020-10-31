#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

#[ink::contract]
mod personal_shipment_transaction {
    #[cfg(not(feature = "ink-as-dependency"))]
    use ink_prelude::vec::Vec;
    use scale::Encode;
    use ink_env::{ hash::{ Blake2x256 } };
    use scale::Decode;
    use ink_storage::{
        traits::{
            PackedLayout,
            SpreadLayout,
        },
    };

    /// The callback selector must match the selector set on the callback function
    /// This value is used when the substrate adapter call back this contract
    const CALLBACK_SELECTOR: &str = "back";
    /// Oracle Account
    const ORACLE_ACCOUNT_ID: [u8;32] = [0x58,0x02,0x18,0x7d,0xc2,0xe2,0xec,0xdd,
                                        0x17,0x98,0x8a,0xdf,0x48,0xb3,0x48,0x81,
                                        0x6d,0xef,0xc2,0xaa,0x37,0xba,0x41,0xb6,
                                        0x2a,0x5c,0xdf,0x60,0x45,0x07,0x63,0x3e];
    /// Oracle Job ID
    const ORACLE_JOB_ID: &str = "03db560d6e064ac8adc492a82bdd484c";

    #[derive(Debug, Copy, Clone, PartialEq, Eq, scale::Encode, scale::Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(::scale_info::TypeInfo, ::ink_storage::traits::StorageLayout))]
    pub enum TransactionStatus {
        Initiated,
        ReceiverPaymentReceived,
        ShippingInitiated,
        ShippingStarted,
        ParcelOnItsWay,
        ParcelReceived,
    }

    #[ink(storage)]
    pub struct PersonalShipmentTransaction {
        sender: AccountId,
        receiver: AccountId,
        goods_description: Vec<u8>,
        goods_price: Balance,
        status: TransactionStatus,
        status_refreshing: bool,

        receiver_payment: Balance,
        tracking_number: Option<Vec<u8>>,
    }

    /// Errors that can occur upon calling this contract.
    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(::scale_info::TypeInfo))]
    pub enum Error {
        WrongCaller,
        WrongStatus,
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
            if !Self::is_called_by_the_stakeholders(sender, receiver){
                ink_env::debug_println("Only both sender and receiver could create contract.");
                panic!("Only both sender and receiver could create contract.")
            }
            Self {  sender,
                    receiver,
                    goods_description,
                    goods_price,
                    status: TransactionStatus::Initiated,
                    status_refreshing: false,
                    receiver_payment: 0,
                    tracking_number: None
            }
        }

        #[ink(message)]
        pub fn status(&self) -> Vec<u8> {
            match self.status{
                TransactionStatus::Initiated => { "Transaction initiated".into() }
                TransactionStatus::ReceiverPaymentReceived => { "Receiver payment done".into() }
                TransactionStatus::ShippingInitiated => { "Tracking number has been issued".into() }
                TransactionStatus::ShippingStarted => { "Parcel has been picked up by the carrier".into() }
                TransactionStatus::ParcelOnItsWay => { "Parcel is on its way".into() }
                TransactionStatus::ParcelReceived => { "Parcel has been received".into() }
            }
        }

        #[ink(message)]
        pub fn status_refreshing(&self) -> bool {
            self.status_refreshing
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
        pub fn receiver_payment(&self) -> Balance {
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
                ink_env::debug_println("Only receiver should pay");
                return Err(Error::WrongCaller);
            }
            if self.status != TransactionStatus::Initiated {
                ink_env::debug_println("For the receiver to pay, the transaction should be initiated");
                return Err(Error::WrongOperator);
            }
            self.receiver_payment = self.env().transferred_balance();
            self.status = TransactionStatus::ReceiverPaymentReceived;
            Ok(())
        }

        #[ink(message)]
        pub fn set_tracking_number(&mut self, tracking_number: Vec<u8>) -> Result<()> {
            let caller = self.env().caller();
            if caller != self.sender {
                ink_env::debug_println("Tracking number has to be set by the sender");
                return Err(Error::WrongCaller);
            }
            if self.status != TransactionStatus::ReceiverPaymentReceived {
                ink_env::debug_println("Tracking number should be set after the payment has been received.");
                return Err(Error::WrongOperator);
            }
            self.tracking_number = Some(tracking_number);
            self.status = TransactionStatus::ShippingInitiated;
            Ok(())
        }

        #[ink(message)]
        pub fn update_shipment_status(&mut self) -> Result<()> {
            if self.status == TransactionStatus::Initiated || self.status == TransactionStatus::ReceiverPaymentReceived {
                ink_env::debug_println("Shipment has not been initiated.");
                return Err(Error::WrongOperator);
            }
            self.send_shipping_status_update_request_from_oracle()
        }

        #[ink(message, selector = "0x6261636B")]
        pub fn set_shipment_status(&mut self, value: u128) -> Result<()> {
            // Assume status is no more refreshing, even if there are some errors
            self.status_refreshing = false;
            if self.status == TransactionStatus::Initiated || self.status == TransactionStatus::ReceiverPaymentReceived {
                ink_env::debug_println("Shipment has not been initiated.");
                return Err(Error::WrongOperator);
            }
            // TODO : check caller is operator
            if value == 0 {
                self.status = TransactionStatus::ShippingStarted;
            } else if value == 1 {
                self.status = TransactionStatus::ParcelOnItsWay;
            } else if value == 2 {
                self.status = TransactionStatus::ParcelReceived;
                return self.shipment_achieved()
            }
            Ok(())
        }

        #[ink(message)]
        pub fn cancel(&mut self) -> Result<()> {
            self.status_refreshing = false;
            if !Self::is_called_by_the_stakeholders(self.sender, self.receiver){
                ink_env::debug_println("Only both sender and receiver could cancel the transaction.");
                return Err(Error::WrongOperator);
            }
            if self.receiver_payment > 0 {
                let transfer_result = self.env().transfer(self.receiver, self.receiver_payment);
                if transfer_result.is_err() {
                    ink_env::debug_println("Transfer failed.");
                    return Err(Error::WrongOperator)
                }
            }
            // TODO : transfer the half of the balance to the receiver
            self.env().terminate_contract(self.sender);
        }

        fn shipment_achieved(&mut self) -> Result<()> {
            let transfer_result = self.env().transfer(self.sender, self.goods_price);
            if transfer_result.is_err() {
                ink_env::debug_println("Transfer failed.");
                return Err(Error::WrongOperator)
            }
            // TODO : transfer the half of the balance to the receiver
            self.env().terminate_contract(self.sender);
        }

        fn is_called_by_the_stakeholders(sender: AccountId, receiver: AccountId) -> bool {
            let stakeholders = PersonalShipmentTransaction::create_multisig_address(&[sender, receiver],2);
            let stakeholders_reverse = PersonalShipmentTransaction::create_multisig_address(&[receiver, sender],2);
            let caller = Self::env().caller();
            caller == stakeholders || caller == stakeholders_reverse
        }

        // From https://substrate.dev/rustdocs/v2.0.0-rc6/src/pallet_multisig/lib.rs.html#518
        fn create_multisig_address(who: &[AccountId], threshold: u16) -> AccountId{
            // TODO : we need to sort the who adresses
            // See https://github.com/polkadot-js/common/blob/56a79924a066ffbc31ea5fae30fe5e81aa913e66/packages/util/src/u8a/sorted.ts
            let entropy = (b"modlpy/utilisuba", who, threshold);
            let mut output = [0;32];
            ink_env::hash_encoded::<Blake2x256, _>(&entropy, &mut output);
            AccountId::decode(&mut &output[..]).unwrap_or_default()
        }

        /// Initiate a request to the given oracle operator
        fn send_shipping_status_update_request_from_oracle(&mut self)-> Result<()> {
            let request_id = 7093;
            let operator = AccountId::decode(&mut &ORACLE_ACCOUNT_ID[..]).unwrap_or_default();
            if let Some(tracking_number) = &self.tracking_number {
                let parameters = ("trackingNumber", tracking_number);
                self.status_refreshing = true;
                Self::env().emit_event(OracleRequest {
                    operator: operator,
                    spec_index: ORACLE_JOB_ID.into(),
                    request_identifier: request_id,
                    who: self.env().account_id(),
                    data_version: 1,
                    bytes: parameters.encode(),
                    function:  CALLBACK_SELECTOR.into(),
                    fee: 93
                });
            }
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
         }

        #[ink::test]
        fn multisig_address_should_work() {
            let multisig_address = PersonalShipmentTransaction::create_multisig_address(&[default_accounts().alice, default_accounts().bob],2);
            let multisig_address_invert = PersonalShipmentTransaction::create_multisig_address(&[default_accounts().bob, default_accounts().alice],2);

            println!("{:?}", multisig_address);
            println!("{:?}", multisig_address_invert);

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
