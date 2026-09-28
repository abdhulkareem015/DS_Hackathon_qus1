"""
SYNTHETIC DEMO DATASET GENERATOR
=================================
⚠ WARNING: This dataset is entirely synthetic and randomly generated.
Patterns are for demonstration only and must NOT be treated as evidence
of real factory behaviour or used to draw engineering conclusions.

Run:  python generate_demo.py
Creates: demo_synthetic_data.csv  (≈ 5 000 rows)
"""
import numpy as np
import pandas as pd
import random

SEED = 42
rng  = np.random.default_rng(SEED)

N_BATCHES   = 100          # production batches
ROWS_BATCH  = 50           # inspections per batch
N_MACHINES  = 6
N_RM        = 20           # raw-material batches
SHIFTS      = ['Morning', 'Evening', 'Night']

def make_dataset(n_batches=N_BATCHES, rows_per_batch=ROWS_BATCH):
    records = []

    machines  = [f'M{str(i).zfill(2)}' for i in range(1, N_MACHINES+1)]
    rm_batches = [f'RM{str(i).zfill(3)}' for i in range(1, N_RM+1)]

    # Give certain machines/RM batches slightly higher defect baselines (synthetic pattern only)
    high_defect_machines = {machines[0]: 0.18, machines[1]: 0.06}
    high_defect_rm       = {rm_batches[0]: 0.20, rm_batches[1]: 0.04}
    shift_adj            = {'Night': 0.05, 'Evening': 0.02, 'Morning': -0.02}

    batch_ids = [f'B{str(i).zfill(3)}' for i in range(1, n_batches+1)]

    for bid in batch_ids:
        machine = rng.choice(machines)
        rm      = rng.choice(rm_batches)
        shift   = rng.choice(SHIFTS)

        # Base defect probability for this batch
        base_p = 0.10
        base_p += high_defect_machines.get(machine, 0)
        base_p += high_defect_rm.get(rm, 0)
        base_p += shift_adj.get(shift, 0)
        base_p  = float(np.clip(base_p, 0.02, 0.60))

        # Temperature/Pressure/Speed — slightly different for high-defect machine (synthetic only)
        temp_mean  = 85.0 + (5.0 if machine == machines[0] else 0.0)
        press_mean = 5.0
        speed_mean = 1200.0

        for _ in range(rows_per_batch):
            temp  = float(rng.normal(temp_mean,  8.0))
            press = float(rng.normal(press_mean, 0.5))
            speed = float(rng.normal(speed_mean, 120.0))

            # Introduce ~3% missing values per numeric col
            if rng.random() < 0.03: temp  = np.nan
            if rng.random() < 0.03: press = np.nan
            if rng.random() < 0.03: speed = np.nan

            # Defect probability increases slightly with high temp (synthetic association only)
            p = base_p
            if not np.isnan(temp) and temp > 95:
                p += 0.05
            p = float(np.clip(p, 0.01, 0.95))

            defect = int(rng.random() < p)

            records.append({
                'Batch_ID':            bid,
                'Machine_ID':          machine,
                'Temperature':         round(temp, 2)  if not np.isnan(temp)  else '',
                'Pressure':            round(press, 2) if not np.isnan(press) else '',
                'Machine_Speed':       round(speed, 0) if not np.isnan(speed) else '',
                'Raw_Material_Batch':  rm,
                'Operator_Shift':      shift,
                'Defect_Status':       defect,
            })

    df = pd.DataFrame(records)
    return df

if __name__ == '__main__':
    df = make_dataset()
    out = 'demo_synthetic_data.csv'
    df.to_csv(out, index=False)
    n_def = (df['Defect_Status'] == 1).sum()
    print(f'[SYNTHETIC] Demo dataset saved → {out}')
    print(f'  Rows: {len(df):,}  |  Batches: {df["Batch_ID"].nunique()}  |  Defective: {n_def:,} ({n_def/len(df)*100:.1f}%)')
    print('  ⚠ This data is SYNTHETIC. Patterns are for demo only, not factory evidence.')
