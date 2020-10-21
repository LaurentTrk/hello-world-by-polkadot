#!/usr/bin/python
import getopt
import json
import sys

import requests

TOKEN_DISPLAY_SYMBOL = 'KSM'
TOKEN_DECIMAL = 12
DEFAULT_DEPTH = 5
DEFAULT_SIDECAR_URL = 'http://127.0.0.1:8080'


def compute_staking_payouts(argv):
    sidecar_url, account_id, depth, era, unclaimed_only = get_parameters(argv)
    display_parameters(account_id, depth, era, sidecar_url, unclaimed_only)
    account_id = use_last_block_author_if_account_is_not_set(account_id, sidecar_url)
    results = compute_payouts(sidecar_url, account_id, depth, era, unclaimed_only)
    display_results(account_id, unclaimed_only, depth, results)


def display_results(account_id, unclaimed_only, depth, results):
    total_payout, payouts_number, claimed_total_payout, unclaimed_total_payout = results
    print(f'Account {account_id} received {payouts_number} payouts for {depth} era(s).')
    if unclaimed_only:
        print(f'Total payout unclaimed is {format_payout(unclaimed_total_payout)}')
    else:
        print(f'Total payout is {format_payout(total_payout)}')
        print(f'{format_payout(claimed_total_payout)} has been claimed.')
        print(f'Still {format_payout(unclaimed_total_payout)} to claimed.')


def compute_payouts(sidecar_url, account_id, depth, era, unclaimed_only):
    staking_payouts = request_staking_payouts(sidecar_url, account_id, depth, era, unclaimed_only)
    eras_payouts = staking_payouts['erasPayouts']
    claimed_total_payout = 0
    unclaimed_total_payout = 0
    total_payout = 0
    payouts_number = 0
    for era_payout in eras_payouts:
        payouts = era_payout['payouts']
        for payout in payouts:
            payout_value = int(payout['nominatorStakingPayout'])
            payouts_number += 1
            total_payout += payout_value
            if payout['claimed']:
                claimed_total_payout += payout_value
            else:
                unclaimed_total_payout += payout_value
    return total_payout, payouts_number, claimed_total_payout, unclaimed_total_payout


def use_last_block_author_if_account_is_not_set(account_id, sidecar_url):
    if len(account_id) == 0:
        print('Using last block author.')
        account_id = request_last_block_author(sidecar_url)
    return account_id


def request_last_block_author(sidecar_url):
    return request_sidecar(f'{sidecar_url}/blocks/head')['authorId']


def request_staking_payouts(sidecar_url, account_id, depth, era, unclaimed_only):
    request_params = f'depth={depth}&unclaimedOnly={str(unclaimed_only).lower()}'
    if era != -1:
        request_params += f'&era={era}'
    return request_sidecar(f'{sidecar_url}/accounts/{account_id}/staking-payouts?{request_params}')


def request_sidecar(sidecar_url):
    sidecar_response = requests.get(sidecar_url)
    if sidecar_response.status_code == 200:
        return json.loads(sidecar_response.text)
    print(f'Sidecar request {sidecar_url} returns {sidecar_response.status_code}. Exiting.')
    sys.exit(sidecar_response.status_code)


def display_parameters(account_id, depth, era, sidecar_url, unclaimed_only):
    print('Sidecar URL : ', sidecar_url)
    print('AccountId : ', account_id)
    print('Depth : ', depth)
    print('Era : ', era)
    print('Unclaimed only : ', unclaimed_only)


def display_help_and_exit(exit_code=0):
    print('stakingPayouts.py [-s <sidecarUrl>] [-a <accountId>] [-d <depth>] [-e <era>] [-c]')
    sys.exit(exit_code)


def get_parameters(argv):
    sidecar_url = DEFAULT_SIDECAR_URL
    account_id = ''
    depth = DEFAULT_DEPTH
    era = -1
    unclaimed_only = True
    try:
        opts, args = getopt.getopt(argv, "hs:a:d:e:c", ["sidecar=", "accountId=", "depth=", "era", "all"])
    except getopt.GetoptError:
        display_help_and_exit(2)
    for opt, arg in opts:
        if opt == '-h':
            display_help_and_exit()
        elif opt in ("-u", "--sidecar"):
            sidecar_url = arg
        elif opt in ("-c", "--all"):
            unclaimed_only = False
        elif opt in ("-a", "--accountId"):
            account_id = arg
        elif opt in ("-d", "--depth"):
            depth = arg
        elif opt in ("-e", "--era"):
            era = arg
    return sidecar_url, account_id, depth, era, unclaimed_only


def format_payout(payout):
    one_token = 10 ** TOKEN_DECIMAL
    one_milli_token = 10 ** (TOKEN_DECIMAL - 3)
    if payout >= one_token:
        return "%.3f%s" % (payout / one_token, TOKEN_DISPLAY_SYMBOL)
    return "%.3fm%s" % (payout / one_milli_token, TOKEN_DISPLAY_SYMBOL)


if __name__ == "__main__":
    compute_staking_payouts(sys.argv[1:])
