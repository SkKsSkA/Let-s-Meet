import json, re, sys, urllib.request, datetime, pathlib
here = pathlib.Path(__file__).parent
cfg = json.loads((here / "cases.json").read_text())
URL = "http://localhost:3100/api/ai/draft"
DATE_WORDS = re.compile(r"(\d{1,2}[:.]\d{2}|понедельник|вторник|сред|четверг|пятниц|суббот|воскресень|сегодня|завтра|\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря))", re.I)

def call(prompt):
    req = urllib.request.Request(URL, data=json.dumps({"prompt": prompt}).encode(), headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def evaluate(case, resp):
    d, it = resp["draft"], case["intended"]
    ok = {}
    ok["type"] = d["kind"] == it["type"]
    t = d["title"].lower()
    ok["title"] = it["title_key"] in t and not DATE_WORDS.search(d["title"])
    ok["datetime"] = d["starts_at"] == it["datetime"]
    ok["place"] = it["place_stem"] in d["location_name"].lower()
    ok["dress_code"] = any(it["dress_stem"] in x.lower() for x in d["dress_code"])
    return ok

stamp = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5))).isoformat(timespec="seconds")
raw, rows = [], []
for c in cfg["cases"]:
    resp = call(c["prompt"])
    raw.append({"id": c["id"], "prompt": c["prompt"], "response": resp})
    ok = evaluate(c, resp)
    wrong = [k for k, v in ok.items() if not v]
    rows.append({"id": c["id"], "A_actions": 5, "B_actions": 2 + len(wrong), "B_fields_correct": 5 - len(wrong), "wrong_fields": wrong, "ok": ok, "source": resp["source"]})
(here / "raw_responses.json").write_text(json.dumps({"run_at": stamp, "endpoint": URL, "results": raw}, ensure_ascii=False, indent=2))
(here / "results.json").write_text(json.dumps({"run_at": stamp, "rows": rows}, ensure_ascii=False, indent=2))
print("run_at", stamp)
for r in rows:
    print(r["id"], "A", r["A_actions"], "B", r["B_actions"], "correct", r["B_fields_correct"], "/5", "wrong:", r["wrong_fields"], "src:", r["source"])
