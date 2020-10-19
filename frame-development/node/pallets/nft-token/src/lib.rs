#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{decl_error, decl_event, decl_module, decl_storage, dispatch};
use frame_support::sp_runtime::DispatchError;
use frame_system::ensure_signed;
use log::info;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

pub trait Trait: frame_system::Trait + orml_nft::Trait {
    type Event: From<Event<Self>> + Into<<Self as frame_system::Trait>::Event>;
}

decl_storage! {
	trait Store for Module<T: Trait> as NFTToken {

		NFTTokenCID get(fn ntf_token_cid): orml_nft::CID;
		NFTTokenClass get(fn ntf_token_class): T::ClassId;
	}
}

// Errors inform users that something went wrong.
decl_error! {
	pub enum Error for Module<T: Trait> {
	}
}

decl_event!(
	pub enum Event<T> where AccountId = <T as frame_system::Trait>::AccountId {
		/// New NFT Token class has been created
		NFTTokenClassCreated(AccountId),
		/// New NFT Token has been minted
		NFTTokenMinted(AccountId),
	}
);


decl_module! {
	pub struct Module<T: Trait> for enum Call where origin: T::Origin {
		type Error = Error<T>;

		fn deposit_event() = default;

		#[weight = 0]
		pub fn create_nft_token(origin, metadata: orml_nft::CID, data : <T as orml_nft::Trait>::ClassData) -> dispatch::DispatchResult {
			let who = ensure_signed(origin)?;
			info!("Start creating nft token");
			<NFTTokenCID>::put(metadata.clone());
			let result: Result<T::ClassId, DispatchError> = orml_nft::Module::<T>::create_class(&who, metadata, data);
			info!("Class ID = {:?}", result);
            <NFTTokenClass<T>>::put(result.unwrap());
			Self::deposit_event(RawEvent::NFTTokenClassCreated(who));
			Ok(())
		}

		#[weight = 0]
		pub fn mint_nft_token(origin, data: <T as orml_nft::Trait>::TokenData) -> dispatch::DispatchResult {
			let who = ensure_signed(origin)?;
			let result: Result<T::TokenId, DispatchError> = orml_nft::Module::<T>::mint(&who,
			    <NFTTokenClass<T>>::get(), <NFTTokenCID>::get(), data);
            info!("Minted Token = {:?}", result);
			Self::deposit_event(RawEvent::NFTTokenMinted(who));
			Ok(())
		}
	}
}
