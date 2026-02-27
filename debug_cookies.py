import browser_cookie3

def test_cookies():
    print("Testing Chrome...")
    try:
        cj = browser_cookie3.chrome(domain_name='tori.fi')
        print(f"Chrome found {len(cj)} cookies for tori.fi")
        for c in cj:
            print(f"  {c.name}={c.value[:10]}...")
    except Exception as e:
        print(f"Chrome error: {e}")

    print("\nTesting Edge...")
    try:
        cj = browser_cookie3.edge(domain_name='tori.fi')
        print(f"Edge found {len(cj)} cookies for tori.fi")
        for c in cj:
            print(f"  {c.name}={c.value[:10]}...")
    except Exception as e:
        print(f"Edge error: {e}")

    print("\nTesting Firefox...")
    try:
        cj = browser_cookie3.firefox(domain_name='tori.fi')
        print(f"Firefox found {len(cj)} cookies for tori.fi")
    except Exception as e:
        print(f"Firefox error: {e}")

if __name__ == "__main__":
    test_cookies()
