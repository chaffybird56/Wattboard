import pandas as pd

def evaluate_alarms(df: pd.DataFrame, rules: list):
    """
    df: index ts, columns include computed metrics (feeder_kw, data_gap_minutes, ...)
    rules: list of alarm dicts from YAML.
    Returns list of triggered alarms.
    """
    triggers = []
    if df.empty:
        return triggers
    latest = df.iloc[-1]
    for r in rules:
        cond = r.get("condition", {})
        metric = cond.get("metric")
        comp   = cond.get("comparator")
        thr    = cond.get("threshold")
        val = latest.get(metric)
        if val is None:
            continue
        ok = (val > thr) if comp == ">" else ((val < thr) if comp == "<" else (val == thr))
        if ok:
            triggers.append({
                "id": r.get("id"),
                "description": r.get("description", ""),
                "level": r.get("level", "info"),
                "value": float(val),
                "threshold": thr
            })
    return triggers