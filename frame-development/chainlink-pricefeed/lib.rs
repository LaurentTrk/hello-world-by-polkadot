#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;


#[ink::contract]
mod chainlink_pricefeed {
    #[cfg(not(feature = "ink-as-dependency"))]
    use ink_prelude::vec::Vec;
    use scale::{ Encode };

    /// The callback selector must match the selector set on the callback function
    /// This value is used when the substrate adapter call back this contract
    const CALLBACK_SELECTOR: &str = "back";

    #[ink(storage)]
    pub struct ChainlinkPriceFeed {
        operator : AccountId,
        spec_index : Vec<u8>,
        request_identifier: u64,
        data_version: u64,

        latest_price: u128,
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
        operator : AccountId,
        spec_index : Vec<u8>,
        request_identifier: u64,
        who: AccountId,
        data_version: u64,
        bytes: Vec<u8>,
        function: Vec<u8>,
        fee: u32
    }

    impl ChainlinkPriceFeed {
        #[ink(constructor)]
        /// Deploy a new contract to get price feeds from Chainlink
        /// The operator account must match the Chainlink operator account set in both
        /// the substrate adapter and the job.
        /// The spec_index is the job id created on the chainlink node
        /// data_version is not used at this moment
        pub fn new(operator: AccountId, spec_index: Vec<u8>, data_version: u64) -> Self {
            Self { latest_price: 0, data_version, operator, spec_index, request_identifier: 0 }
        }

        #[ink(message)]
        /// The latest price value received from Chainlink
        pub fn latest_price(&self) -> u128 {
            self.latest_price.clone()
        }

        #[ink(message)]
        /// Get the latest price of a given price pair (ie ETH/USD)
        pub fn get_latest_price(&mut self, price_pair: Vec<u8>) -> Result<()> {
            let parameters = ("pricePair", price_pair);
            self.initiate_request(parameters.encode(), 93)
        }

        /// Initiate a request to the given oracle operator
        pub fn initiate_request(&mut self, data: Vec<u8>, fee: u32)-> Result<()> {
            // let who : <T as frame_system::Trait>::AccountId = ensure_signed(origin.clone())?;
            //
            // ensure!(<Operators<T>>::contains_key(operator.clone()), Error::<T>::UnknownOperator);
            // ensure!(fee > 0, Error::<T>::InsufficientFee);
            //
            // T::Currency::reserve(&who, fee.into())?;
            //
            let request_id = self.request_identifier.clone();
            self.request_identifier = request_id + 1;

            // let now = frame_system::Module::<T>::block_number();
            // Requests::<T>::insert(request_id.clone(), (operator.clone(), vec![callback], now, fee));

            Self::env().emit_event(OracleRequest {
                operator: self.operator,
                spec_index: self.spec_index.clone(),
                request_identifier: request_id.clone(),
                who: self.env().account_id(),
                data_version: self.data_version.clone(),
                bytes: data,
                function:  CALLBACK_SELECTOR.into(),
                fee
            });
            Ok(())
        }

        #[ink(message, selector = "0x6261636B")]
        /// The callback to set the latest price value
        /// This method will be called by the Substrate adapter
        pub fn set_value(&mut self, value: u128) -> Result<()> {
            let caller = self.env().caller();
            if caller != self.operator{
                ink_env::debug_println("Callback called by wrong operator.");
                return Err(Error::WrongOperator)
            }
            self.latest_price = value;
            Ok(())
        }
    }

/// Unit tests.t
    #[cfg(test)]
    mod tests {
        use ink_lang as ink;
    use ::ink_env::{
             Environment,
             DefaultEnvironment,
             call::{build_call, Selector, ExecutionInput}
         };
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

        fn default_accounts(
        ) -> ink_env::test::DefaultAccounts<ink_env::DefaultEnvironment> {
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
