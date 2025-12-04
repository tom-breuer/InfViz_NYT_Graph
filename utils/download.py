import json
import time
import requests
import argparse

from tqdm import tqdm

API_KEY = "[YOUR API KEY HERE]"
MAX_CALLS = 400


def execute(year: int, month: int):
    global API_KEY
    requestUrl = f"https://api.nytimes.com/svc/archive/v1/{str(year)}/{str(month)}.json?api-key={API_KEY}"
    requestHeaders = {"Accept": "application/json"}

    response = requests.get(requestUrl, headers=requestHeaders)
    if response.status_code != 200:
        print("Non 200 Response")
        exit(1)

    return response.json()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Downloader for NYT Data")
    parser.add_argument("--startyear", required=True, type=int)
    parser.add_argument("--endyear", required=True, type=int)
    parser.add_argument("--startmonth", required=True, type=int)
    args = parser.parse_args()

    startyear = args.startyear
    endyear = args.endyear
    startmonth = args.startmonth
    call_counter = 0
    for year in range(startyear, endyear + 1):
        print(f"Doing Year {year}")
        for month in tqdm(range(startmonth if year == startyear else 1, 12 + 1)):
            if call_counter <= MAX_CALLS:
                rsp = execute(year, month)
                call_counter += 1
            else:
                print("Reached MAX CALL COUNT as specified")
                exit(0)
            with open(f"data\\rsp_{str(year)}_{str(month)}.json", "w") as f:
                json.dump(rsp, f, indent=4)

            time.sleep(12)  # to avoid hitting the rate limit
