import requests
import json
import re

def main():
    try:
        with open('tori_auth.json', 'r') as f:
            auth_data = json.load(f)
    except Exception as e:
        print(f"Error reading auth: {e}")
        return

    # Convert puppeteer cookies to request cookies
    cj = requests.cookies.RequestsCookieJar()
    for c in auth_data.get('cookies', []):
        cj.set(c['name'], c['value'], domain=c['domain'], path=c['path'])

    target_listing_id = "36780539" # DDR5 Ram-muisti 32Gt 6000Mhz RGB
    url = f"https://www.tori.fi/messages/new/{target_listing_id}"
    
    print(f"Fetching {url}...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    
    resp = requests.get(url, cookies=cj, headers=headers)
    print(f"Status Code: {resp.status_code}")
    html = resp.text
    print("Page length:", len(html))
    
    with open("tori_page.html", "w", encoding="utf-8") as f:
        f.write(html)
        
    # Extract API tokens
    match = re.search(r'window\.__PRELOADED_STATE__\s*=\s*({.*?});', html)
    if match:
        try:
            state = json.loads(match.group(1))
            with open("tori_state.json", "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)
            print("Successfully extracted __PRELOADED_STATE__ to tori_state.json")
        except Exception as e:
            print(f"Error parsing JSON: {e}")
    else:
        print("Could not find __PRELOADED_STATE__ in HTML")
        
        # Check NEXT_DATA
        next_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
        if next_match:
            state = json.loads(next_match.group(1))
            with open("tori_next_data.json", "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)
            print("Successfully extracted __NEXT_DATA__ to tori_next_data.json")
            
        else:
            print("No state objects found.")

if __name__ == "__main__":
    main()
