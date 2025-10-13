import pandas as pd

def compute_quality_flags(df: pd.DataFrame, max_missing_pct_per_hour=20):
    """
    Expects df with index=ts and columns [kw, kvar, volts, hertz].
    Flags rows with NaNs; computes hourly missing %.
    """
    if df.empty:
        df['quality_ok'] = True
        return df, pd.Series(dtype=float)
    df = df.sort_index()
    hourly = df.resample("H").apply(lambda x: x.isna().mean()*100)  # % missing per column
    dq_hourly = hourly.max(axis=1)  # worst column per hour
    df['quality_ok'] = True
    if not dq_hourly.empty:
        bad_hours = dq_hourly[dq_hourly > max_missing_pct_per_hour]
        for h in bad_hours.index:
            mask = (df.index >= h) & (df.index < h + pd.Timedelta(hours=1))
            df.loc[mask, 'quality_ok'] = False
    return df, dq_hourly