use crate::{Error, mock::*, HackathonDetails};
use frame_support::{assert_ok, assert_noop};

#[test]
fn it_works_for_default_value() {
	new_test_ext().execute_with(|| {
		// Dispatch a signed extrinsic.
		assert_ok!(TemplateModule::do_something(Origin::signed(1), 42));
		// Read pallet storage and assert an expected result.
		assert_eq!(TemplateModule::something(), Some(42));
	});
}

#[test]
fn storing_hackathon_details_should_work() {
	new_test_ext().execute_with(|| {
		let details = HackathonDetails{ username : Vec::from("laurenttrk") , challenges_submitted: 10, bounties_prize: None };
		assert_ok!(TemplateModule::update_hackathon_details(Origin::signed(1), details.clone()));
		assert_eq!(TemplateModule::get_hackathon_details(), details);
	});
}

#[test]
fn correct_error_for_none_value() {
	new_test_ext().execute_with(|| {
		// Ensure the expected error is thrown when no value is present.
		assert_noop!(
			TemplateModule::cause_error(Origin::signed(1)),
			Error::<Test>::NoneValue
		);
	});
}
