#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;


#[ink::contract]
mod charity_raffle {
    #[cfg(not(feature = "ink-as-dependency"))]
    use ink_storage::{
        collections::HashMap as StorageHashMap,
        collections::Vec as StorageVec,
    };

    /// Number of winners
    const MAX_WINNERS: usize = 2;
    // On unit : seems that the Polkadot UI has not the same number of decimals
    // Than the substrate templates...
    // The unit here are compliant with the Polkadot UI
    /// Minimum player bet is 0.01 unit
    const MINIMUM_BET: u128 = 10_000_000_000_000;
    /// Maximum player bet is 0.1 unit
    const MAXIMUM_BET: u128 = 100_000_000_000_000;

    #[ink(storage)]
    pub struct CharityRaffle {
        /// The charity pot account. Will receive the contract funds when at raffle end
        charity_pot: AccountId,
        /// The charity pot balance.
        charity_pot_balance: Balance,
        /// The list of players
        players: StorageVec<AccountId>,
        /// Map to take reference of players (to prevent a player to play more than 1 time)
        unique_players: StorageHashMap<AccountId, bool>,
        /// The list of winners
        winners: [Option<AccountId>; MAX_WINNERS],
        /// The starting raffle date, soon as when minimum players are playing
        start_date: Option<Timestamp>,
        /// The minimum players required to start the raffle
        minimum_players: u32,
        /// The minimum raffle duration before starting the raffle
        minimum_raffle_duration: u64,
    }

    /// Errors that can occur upon calling this contract.
    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(::scale_info::TypeInfo))]
    pub enum Error {
        /// The user has already played for this raffle
        UserHasAlreadyPlayed,
        /// Bet should be between 0.1 and 0.01 Unit
        IncorrectBet,
        /// Raffle cannot be drawn yet
        RaffleNotDrawable,
        /// Raffle is closed
        RaffleClosed,
        /// The transfer has failed
        TransferFailed,
    }
    pub type Result<T> = core::result::Result<T, Error>;

    #[ink(event)]
    /// New raffle created
    pub struct NewRaffle {
        #[ink(topic)]
        /// The charity pot account. Will receive the contract funds when at raffle end
        charity_pot: AccountId,
    }

    #[ink(event)]
    /// New player enters the raffle
    pub struct NewPlayer {
        #[ink(topic)]
        /// The player account
        player: AccountId,
    }

    #[ink(event)]
    /// The raffle is started, meaning enough players are playing
    pub struct RaffleStarted {
        #[ink(topic)]
        /// The start date
        start_date: Timestamp,
    }

    #[ink(event)]
    /// A winner has been picked
    pub struct WinnerPicked {
        #[ink(topic)]
        /// The winner account
        winner: AccountId,
    }

    #[ink(event)]
    pub struct TransferFailed {
    }

    #[ink(event)]
    /// The raffle is closed. All winners have been picked.
    pub struct RaffleClosed {
        #[ink(topic)]
        /// The balance amount being tranferred to the charity pot account
        transferred_to_charity_pot: Balance,
    }

    impl CharityRaffle {
        #[ink(constructor)]
        /// Create a new raffle
        pub fn new(charity_pot: AccountId, minimum_players: u32, minimum_raffle_duration: u64) -> Self {
            let instance = Self {
                charity_pot,
                charity_pot_balance: 0,
                players: StorageVec::new(),
                unique_players: StorageHashMap::new(),
                winners: [None, None],
                start_date: None,
                minimum_players: Self::minimum_players_should_be_at_least_maximum_winners(minimum_players),
                minimum_raffle_duration,
            };

            Self::env().emit_event(NewRaffle {
                charity_pot,
            });
            instance
        }

        #[ink(message)]
        /// The charity pot account. Will receive the contract funds when at raffle end
        pub fn charity_pot(&self) -> AccountId {
            self.charity_pot
        }

        #[ink(message)]
        /// The charity pot account. Will receive the contract funds when at raffle end
        pub fn charity_pot_balance(&self) -> Balance {
            self.charity_pot_balance
        }

        #[ink(message)]
        /// The winners of this raffle
        pub fn winners(&self) -> [Option<AccountId>; MAX_WINNERS] {
            self.winners
        }

        #[ink(message)]
        /// How many players have played ?
        pub fn players_number(&self) -> u32 {
            let mut players = self.players.len();
            if let Some(_) = self.winners[0] {
                players += 1;
            }
            if let Some(_) = self.winners[1] {
                players += 1;
            }
            players
        }

        #[ink(message)]
        /// The raffle start has soon as the minimum players required is reached
        pub fn is_started(&self) -> bool {
            if let Some(_m) = &self.start_date {
                return true;
            }
            false
        }

        #[ink(message)]
        /// The raffle is closed
        pub fn is_closed(&self) -> bool {
            self.winners[0] != None && self.winners[1] != None
        }

        #[ink(message)]
        /// The raffle is drawable when it is started and the minimum raffle duration is reached
        pub fn is_drawable(&self) -> bool {
            self.is_started() && !self.is_closed() && self.minimum_raffle_duration_is_not_set_or_has_expired()
        }

        #[ink(message, payable)]
        /// Play (you can do this only one time)
        pub fn play(&mut self) -> Result<()>  {
            let user = self.env().caller();
            if self.is_closed(){
                return Err(Error::RaffleClosed)
            }
            if !self.player_has_bet_enough_but_not_too_much(){
                return Err(Error::IncorrectBet)
            }
            if self.user_has_already_play(user){
                return Err(Error::UserHasAlreadyPlayed)
            }
            self.add_new_player(user);
            self.charity_pot_balance += self.env().transferred_balance();
            self.start_raffle_if_enough_players();
            return Ok(())
        }

        #[ink(message)]
        /// Draw a winner
        pub fn draw(&mut self)-> Result<()>  {
            if !self.is_drawable() {
                return Err(Error::RaffleNotDrawable)
            }
            let winner = self.pick_a_winner();
            self.declare_winner(winner)
        }

        #[ink(message)]
        /// Terminate the raffle contract
        pub fn terminate(&mut self) {
            if self.is_closed() {
                self.env().terminate_contract(self.charity_pot)
            }
        }

        fn declare_winner(&mut self, winner: AccountId) -> Result<()> {
            let winner_index = self.find_free_winner_index();
            if winner_index < MAX_WINNERS {
                self.winners[winner_index] = Some(winner);
                Self::env().emit_event(WinnerPicked {
                    winner,
                });
                return self.terminate_raffle_if_we_have_all_the_winners()
            }
            Err(Error::RaffleClosed)
        }

        fn find_free_winner_index(&mut self) -> usize {
            let mut winner_index = 0;
            while winner_index < MAX_WINNERS && self.winners[winner_index] != None {
                winner_index += 1;
            }
            winner_index
        }


        fn terminate_raffle_if_we_have_all_the_winners(&mut self) -> Result<()> {
            if self.is_closed() {
                Self::env().emit_event(RaffleClosed {
                    transferred_to_charity_pot: self.charity_pot_balance,
                });
                return self.transfer_collected_funds_to_charity_pot()
            }
            Ok(())
        }

        fn transfer_collected_funds_to_charity_pot(&mut self) -> Result<()> {
            let transfer_result = self.env().transfer(self.charity_pot, self.charity_pot_balance);
            if transfer_result.is_err() {
                Self::env().emit_event(TransferFailed {});
                return Err(Error::TransferFailed)
            }
            return Ok(())
        }

        fn minimum_raffle_duration_is_not_set_or_has_expired(&self) -> bool {
            self.minimum_raffle_duration == 0 || self.raffle_duration() >  self.minimum_raffle_duration
        }

        fn now() -> Timestamp {
            Self::env().block_timestamp()
        }

        fn add_new_player(&mut self, player: AccountId) {
            self.players.push(player);
            self.unique_players.insert(player, true);
        }

        fn user_has_already_play(&self, player: AccountId) -> bool {
            self.unique_players.contains_key(&player)
        }

        fn start_raffle_if_enough_players(&mut self) {
            if !self.is_started() && self.players.len() >= self.minimum_players {
                let start_date = Self::now();
                self.start_date = Some(start_date);
                Self::env().emit_event(RaffleStarted { start_date });
            }
        }

        fn raffle_duration(&self) -> u64 {
            if let Some(start_date) = self.start_date {
                return Self::now() - start_date;
            }
            0
        }

        fn pick_a_winner(&mut self) -> AccountId {
            let winner_index = self.pick_a_winner_index();
            let winner = *self.players.get(winner_index).unwrap();
            self.set_last_player_picked_index(winner_index);
            winner
        }

        fn set_last_player_picked_index(&mut self, picked_index: u32) {
            let last_player = self.players.pop().unwrap();
            let _ = self.players.set(picked_index, last_player);
        }

        fn pick_a_winner_index(&self) -> u32 {
            let random_number: u32 = Self::get_random_number();
            random_number % self.players.len()
        }

        fn minimum_players_should_be_at_least_maximum_winners(minimum_players: u32) -> u32 {
            if minimum_players > MAX_WINNERS as u32 {
                return minimum_players
            }
            MAX_WINNERS as u32
        }

        fn player_has_bet_enough_but_not_too_much(&self) -> bool {
            let bet = self.env().transferred_balance();
            bet >= MINIMUM_BET && bet <= MAXIMUM_BET
        }

        fn get_random_number() -> u32 {
            let seed: [u8; 8] = [70, 93, 3, 03, 15, 124, 148, 18];
            // Not really cryptographic random but I guess that's enough for this raffle
            let random_hash = Self::env().random(&seed);
            Self::as_u32_be(&random_hash.as_ref())
        }

        fn as_u32_be(array: &[u8]) -> u32 {
            ((array[0] as u32) << 24) +
                ((array[1] as u32) << 16) +
                ((array[2] as u32) << 8) +
                ((array[3] as u32) << 0)
        }

    }

    /// Unit tests.t
    #[cfg(test)]
    mod tests {
        use ink_lang as ink;

        /// Imports all the definitions from the outer scope so we can use them here.
        use super::*;

        const DEFAULT_CALLEE_HASH: [u8; 32] = [0x07; 32];
        const DEFAULT_GAS_LIMIT: Balance = 1_000_000;
        const MINIMUM_PLAYERS: u32 = 5;
        const MINIMUM_RAFFLE_DURATION_IN_MS: u64 = 900000;

        #[ink::test]
        fn new_works() {
            let charity = CharityRaffle::new(default_accounts().frank, MINIMUM_PLAYERS, MINIMUM_RAFFLE_DURATION_IN_MS);

            // Transfer event triggered during initial construction.
            let emitted_events = ink_env::test::recorded_events().collect::<Vec<_>>();
            assert_eq!(1, emitted_events.len());
            assert_eq!(charity.charity_pot(), default_accounts().frank);
            assert_eq!(charity.is_started(), false);
            assert_eq!(charity.is_drawable(), false);
        }

        #[ink::test]
        fn play_with_not_enough_bet_should_fail() {
            let mut charity = create_default_charity_raffle();
            set_next_caller(default_accounts().alice, Some(MINIMUM_BET - 10));
            assert_eq!(charity.play(), Err(Error::IncorrectBet));
        }

        #[ink::test]
        fn play_with_too_much_bet_should_fail() {
            let mut charity = create_default_charity_raffle();
            set_next_caller(default_accounts().alice, Some(MAXIMUM_BET + 10));
            assert_eq!(charity.play(), Err(Error::IncorrectBet));
        }

        #[ink::test]
        fn play_with_1_player() {
            let mut charity = create_default_charity_raffle();
            set_next_caller(default_accounts().alice, None);
            assert_eq!(charity.play(), Ok(()));
            assert_eq!(charity.is_started(), false);
            assert_eq!(charity.is_drawable(), false);
        }

        #[ink::test]
        fn player_can_only_play_one_time() {
            let mut charity = create_default_charity_raffle();
            set_next_caller(default_accounts().alice, None);
            assert_eq!(charity.play(), Ok(()));
            assert_eq!(charity.play(), Err(Error::UserHasAlreadyPlayed));
        }

        #[ink::test]
        fn play_with_2_players() {
            let mut charity = create_default_charity_raffle();
            set_next_caller(default_accounts().alice, None);
            assert_eq!(charity.play(), Ok(()));
            set_next_caller(default_accounts().bob, None);
            assert_eq!(charity.play(), Ok(()));
        }

        #[ink::test]
        fn play_with_enough_players_to_start_raffle() {
            let mut charity = create_default_charity_raffle();
            start_raffle(&mut charity);
            assert_eq!(charity.is_started(), true);
        }

        #[ink::test]
        fn draw_after_raffle_has_started() {
            let mut charity = create_default_charity_raffle();
            start_raffle(&mut charity);
            assert_eq!(charity.draw(), Err(Error::RaffleNotDrawable));
        }

        #[ink::test]
        fn draw_after_wait_after_raffle_has_started() {
            let mut charity = CharityRaffle::new(default_accounts().frank, MINIMUM_PLAYERS, 0);
            start_raffle(&mut charity);
            assert_eq!(charity.draw(), Ok(()));
            assert_eq!(charity.draw(), Err(Error::TransferFailed));
        }

        /// We should have same random numbers within the same execution
        #[ink::test]
        fn random_number_should_works() {
            let random_number = CharityRaffle::get_random_number();
            let another_random_number = CharityRaffle::get_random_number();
            assert_eq!(random_number, another_random_number);
        }

        fn create_default_charity_raffle() -> CharityRaffle {
            CharityRaffle::new(default_accounts().frank, MINIMUM_PLAYERS, MINIMUM_RAFFLE_DURATION_IN_MS)
        }

        fn start_raffle(charity: &mut CharityRaffle) {
            for player_index in 1..charity.minimum_players + 1 {
                let player = AccountId::from([player_index as u8; 32]);
                set_next_caller(player, None);
                assert_eq!(charity.is_started(), false);
                assert_eq!(charity.play(), Ok(()));
            }
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
