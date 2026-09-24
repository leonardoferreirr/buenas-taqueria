#!/bin/bash
# Roda o Lighthouse N vezes e mostra a mediana (a máquina oscila entre execuções).
cd "$(dirname "$0")/.."
LH=~/.npm/_npx/ffe2131771d88588/node_modules/.bin/lighthouse
N=${1:-3}
for i in $(seq 1 "$N"); do
  "$LH" http://127.0.0.1:8751/ --only-categories=performance,accessibility,best-practices \
    --throttling-method=devtools --form-factor=mobile --screenEmulation.mobile --quiet \
    --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
    --output=json --output-path=".audit/lh-run$i.json" > /dev/null 2>&1
done
python3 - "$N" <<'PY'
import json, sys, statistics as st
n = int(sys.argv[1]); runs = []
for i in range(1, n+1):
    d = json.load(open(f".audit/lh-run{i}.json")); a = d["audits"]
    runs.append({"perf": round(d["categories"]["performance"]["score"]*100),
                 "a11y": round(d["categories"]["accessibility"]["score"]*100),
                 "bp": round(d["categories"]["best-practices"]["score"]*100),
                 "FCP": a["first-contentful-paint"]["numericValue"]/1000,
                 "LCP": a["largest-contentful-paint"]["numericValue"]/1000,
                 "TBT": a["total-blocking-time"]["numericValue"],
                 "CLS": a["cumulative-layout-shift"]["numericValue"],
                 "SI": a["speed-index"]["numericValue"]/1000})
for i, r in enumerate(runs, 1):
    print(f"  run{i}: perf {r['perf']}  FCP {r['FCP']:.1f}s  LCP {r['LCP']:.1f}s  TBT {r['TBT']:.0f}ms  CLS {r['CLS']:.3f}  SI {r['SI']:.1f}s")
m = lambda k: st.median(r[k] for r in runs)
print(f"\nMEDIANA  perf {m('perf'):.0f}  a11y {m('a11y'):.0f}  boas práticas {m('bp'):.0f}")
print(f"         FCP {m('FCP'):.1f}s  LCP {m('LCP'):.1f}s  TBT {m('TBT'):.0f}ms  CLS {m('CLS'):.3f}  SI {m('SI'):.1f}s")
PY
