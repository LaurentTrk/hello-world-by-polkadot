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
    /// Minimum player bet is 0.01 unit
    const MINIMUM_BET: u128 = 10000000000000;
    /// Maximum player bet is 0.1 unit
    const MAXIMUM_BET: u128 = 100000000000000;

    #[ink(storage)]
    pub struct CharityRaffle {
        /// The charity pot account. Will receive the contract funds when at raffle end
        charity_pot: AccountId,
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
        RaffleNotDrawable
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
        /// The winners of this raffle
        pub fn winners(&self) -> [Option<AccountId>; MAX_WINNERS] {
            self.winners
        }

        #[ink(message)]
        /// How many players have played ?
        pub fn players_number(&self) -> u32 {
            self.players.len()
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
        /// The raffle is drawable when it is started and the minimum raffle duration is reached
        pub fn is_drawable(&self) -> bool {
            self.is_started() && !self.is_closed() && self.minimum_raffle_duration_is_not_set_or_has_expired()
        }

        #[ink(message, payable)]
        /// Play (you can do this only one time)
        pub fn play(&mut self) -> Result<()>  {
            let user = self.env().caller();
            if !self.is_closed() && self.player_has_bet_enough_but_not_too_much() {
                if self.user_has_not_already_play(user) {
                    self.add_new_player(user);
                    self.start_raffle_if_enough_players();
                    return Ok(())
                }
                return Err(Error::UserHasAlreadyPlayed)
            }
            Err(Error::IncorrectBet)
        }

        #[ink(message)]
        /// Draw a winner
        pub fn draw(&mut self)-> Result<()>  {
            if self.is_drawable() {
                let winner_index = self.pick_a_winner();
                let winner = *self.players.get(winner_index).unwrap();
                let last_player = self.players.pop().unwrap();
                let _ = self.players.set(winner_index, last_player);
                self.declare_winner(winner);
                return Ok(())
            }
            Err(Error::RaffleNotDrawable)
        }

        fn declare_winner(&mut self, winner: AccountId) -> bool{
            let winner_index = self.find_free_winner_index();
            if winner_index < MAX_WINNERS {
                self.winners[winner_index] = Some(winner);
                Self::env().emit_event(WinnerPicked {
                    winner,
                });
                self.terminate_raffle_if_we_have_all_the_winners();
                return true;
            }
            false
        }

        fn find_free_winner_index(&mut self) -> usize {
            let mut winner_index = 0;
            while winner_index < MAX_WINNERS && self.winners[winner_index] != None {
                winner_index += 1;
            }
            winner_index
        }

        fn is_closed(&self) -> bool {
            self.winners[0] != None && self.winners[1] != None
        }

        fn terminate_raffle_if_we_have_all_the_winners(&mut self) {
            if self.is_closed() {
                Self::env().emit_event(RaffleClosed {
                    transferred_to_charity_pot: self.env().balance(),
                });
                let _ = self.env().terminate_contract(self.charity_pot);
            }
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

        fn user_has_not_already_play(&self, player: AccountId) -> bool {
            !self.unique_players.contains_key(&player)
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

        fn pick_a_winner(&self) -> u32 {
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
        const DEFAULT_ENDOWMENT: Balance = 1_000_000;
        const DEFAULT_GAS_LIMIT: Balance = 1_000_000;
        const MINIMUM_PLAYERS: u32 = 5;
        const MINIMUM_RAFFLE_DURATION_IN_MS: u64 = 900000;

        fn default_accounts(
        ) -> ink_env::test::DefaultAccounts<ink_env::DefaultEnvironment> {
            ink_env::test::default_accounts::<ink_env::DefaultEnvironment>()
                .expect("off-chain environment should have been initialized already")
        }

        fn set_next_caller(caller: AccountId) {
            ink_env::test::push_execution_context::<ink_env::DefaultEnvironment>(
                caller,
                AccountId::from(DEFAULT_CALLEE_HASH),
                DEFAULT_ENDOWMENT,
                DEFAULT_GAS_LIMIT,
                ink_env::test::CallData::new(ink_env::call::Selector::new([0x00; 4])),
            )
        }

        #[ink::test]
        fn new_works() {
            let charity_pot = AccountId::from([0x01; 32]);
            let charity = CharityRaffle::new(charity_pot, MINIMUM_PLAYERS, MINIMUM_RAFFLE_DURATION_IN_MS);

            // Transfer event triggered during initial construction.
            let emitted_events = ink_env::test::recorded_events().collect::<Vec<_>>();
            assert_eq!(1, emitted_events.len());
            assert_eq!(charity.charity_pot(), charity_pot);
            assert_eq!(charity.is_started(), false);
            assert_eq!(charity.is_drawable(), false);
        }

        fn create_default_charity_raffle() -> CharityRaffle {
            let charity_pot = AccountId::from([0x01; 32]);
            CharityRaffle::new(charity_pot, MINIMUM_PLAYERS, MINIMUM_RAFFLE_DURATION_IN_MS)
        }

        #[ink::test]
        fn play_with_1_player() {
            let default_accounts = default_accounts();
            set_next_caller(default_accounts.alice);

            let mut charity = create_default_charity_raffle();

            assert_eq!(charity.play(), Ok(()));
            assert_eq!(charity.is_started(), false);
            assert_eq!(charity.is_drawable(), false);
        }

        #[ink::test]
        fn player_can_only_play_one_time() {
            let default_accounts = default_accounts();
            set_next_caller(default_accounts.alice);

            let mut charity = create_default_charity_raffle();

            assert_eq!(charity.play(), Ok(()));
            assert_eq!(charity.play(), Err(Error::UserHasAlreadyPlayed));
        }

        #[ink::test]
        fn play_with_2_players() {
            let default_accounts = default_accounts();
            set_next_caller(default_accounts.alice);

            let mut charity = create_default_charity_raffle();

            assert_eq!(charity.play(), Ok(()));
            set_next_caller(default_accounts.bob);
            assert_eq!(charity.play(), Ok(()));
        }

        #[ink::test]
        fn play_with_enough_players_to_start_raffle() {
            let mut charity = create_default_charity_raffle();

            start_raffle(&mut charity);
            assert_eq!(charity.is_started(), true);
        }

        fn start_raffle(charity: &mut CharityRaffle) {
            for player_index in 1..charity.minimum_players + 1 {
                let player = AccountId::from([player_index as u8; 32]);
                set_next_caller(player);
                assert_eq!(charity.is_started(), false);
                assert_eq!(charity.play(), Ok(()));
            }
        }

        #[ink::test]
        fn draw_immediatly_after_raffle_has_started() {
            let mut charity = create_default_charity_raffle();

            start_raffle(&mut charity);
            assert_eq!(charity.draw(), Err(Error::RaffleNotDrawable));
        }

        #[ink::test]
        fn draw_after_wait_after_raffle_has_started() {
            let charity_pot = AccountId::from([0x01; 32]);
            let mut charity = CharityRaffle::new(charity_pot, MINIMUM_PLAYERS, 0);

            start_raffle(&mut charity);

            charity.minimum_raffle_duration = 0;

            assert_eq!(charity.draw(), Ok(()));
            // TODO : If we draw again, the contract will terminate and panic
            // 'not implemented: off-chain environment does not support contract termination'
        }

        /// We should have same random numbers within the same execution
        #[ink::test]
        fn random_number_should_works() {
            let random_number = CharityRaffle::get_random_number();
            let another_random_number = CharityRaffle::get_random_number();
            assert_eq!(random_number, another_random_number);
        }

    }
}