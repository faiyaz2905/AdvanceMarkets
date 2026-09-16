#!/usr/bin/env py
"""
======================================================================
AdvanceMarkets Terminal — Carbon Market Web Price Scraper Tool (CLI)
======================================================================
Usage:
    py scrape_prices.py
    py scrape_prices.py --json
======================================================================
"""
import sys
import asyncio
import json

# Force UTF-8 stdout encoding for Windows PowerShell / CMD compatibility
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from backend.scrapers.price_scraper import scrape_all_prices

def print_terminal_table(data: dict):
    print("=" * 80)
    print(" ADVANCEMARKETS TERMINAL — LIVE SCRAPED CARBON PRICES")
    print("=" * 80)
    
    etf_quotes = data.get("etf_quotes", {})
    print("\n[+] FINANCIAL CARBON & CLEAN ENERGY ETFs (SCRAPED):")
    print("-" * 80)
    print(f"{'TICKER':<8} {'NAME':<42} {'PRICE':<10} {'CHANGE':<10} {'% CHANGE':<10}")
    print("-" * 80)
    
    for sym, q in etf_quotes.items():
        if "error" in q and q.get("close") is None:
            print(f"{sym:<8} {q.get('name', sym):<42} {'ERROR':<10} {'--':<10} {'--':<10}")
        else:
            p_str = f"${q['close']:.2f}" if q.get("close") is not None else "--"
            c_str = f"{q['change']:+.2f}" if q.get("change") is not None else "--"
            pct_str = f"{q['percent_change']:+.2f}%" if q.get("percent_change") is not None else "--"
            print(f"{sym:<8} {q.get('name', sym)[:40]:<42} {p_str:<10} {c_str:<10} {pct_str:<10}")

    benchmarks = data.get("carbon_benchmarks", [])
    print("\n[+] VOLUNTARY & COMPLIANCE CARBON BENCHMARKS (SCRAPED):")
    print("-" * 80)
    print(f"{'MARKET / CREDIT TYPE':<45} {'PRICE':<20} {'CHANGE':<15}")
    print("-" * 80)
    for b in benchmarks:
        print(f"{b['market']:<45} {b['price']:<20} {b['change']:<15}")
    print("=" * 80)
    print("✅ Price check complete.\n")

def main():
    if "--json" in sys.argv:
        res = asyncio.run(scrape_all_prices())
        print(json.dumps(res, indent=2))
    else:
        print("\n[*] Scraping carbon prices from live web sources...\n")
        res = asyncio.run(scrape_all_prices())
        print_terminal_table(res)

if __name__ == "__main__":
    main()
