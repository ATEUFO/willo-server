import numpy as np
import pandas as pd

def generate_sepsis_dataset(n_samples: int = 2000, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    # Generate labels: 0 (low risk), 1 (moderate risk), 2 (high/critical risk)
    y = np.random.choice([0, 1, 2], size=n_samples, p=[0.55, 0.25, 0.20])
    
    temp = np.zeros(n_samples)
    hr = np.zeros(n_samples)
    sys_bp = np.zeros(n_samples)
    dia_bp = np.zeros(n_samples)
    rr = np.zeros(n_samples)
    spo2 = np.zeros(n_samples)
    wbc = np.zeros(n_samples)
    lactate = np.zeros(n_samples)
    gcs = np.zeros(n_samples)
    platelets = np.zeros(n_samples)
    crp = np.zeros(n_samples)
    age = np.random.randint(18, 90, size=n_samples)
    sex = np.random.choice([0, 1], size=n_samples)
    
    for i in range(n_samples):
        if y[i] == 0:  # Normal / Low risk
            temp[i] = np.random.normal(36.8, 0.4)
            hr[i] = np.random.normal(72, 10)
            sys_bp[i] = np.random.normal(120, 10)
            dia_bp[i] = np.random.normal(80, 8)
            rr[i] = np.random.normal(16, 2)
            spo2[i] = np.random.normal(98, 1)
            wbc[i] = np.random.normal(7500, 1500)
            lactate[i] = np.random.normal(1.1, 0.3)
            gcs[i] = 15
            platelets[i] = np.random.normal(250000, 40000)
            crp[i] = np.random.normal(4.0, 2.0)
        elif y[i] == 1:  # Moderate risk
            temp[i] = np.random.normal(38.2, 0.5)
            hr[i] = np.random.normal(96, 12)
            sys_bp[i] = np.random.normal(108, 12)
            dia_bp[i] = np.random.normal(70, 8)
            rr[i] = np.random.normal(21, 3)
            spo2[i] = np.random.normal(95, 2)
            wbc[i] = np.random.normal(12500, 3000)
            lactate[i] = np.random.normal(2.1, 0.6)
            gcs[i] = np.random.choice([14, 15], p=[0.3, 0.7])
            platelets[i] = np.random.normal(160000, 30000)
            crp[i] = np.random.normal(45.0, 15.0)
        else:  # High / Critical risk
            temp[i] = np.random.choice([np.random.normal(39.1, 0.6), np.random.normal(35.4, 0.4)], p=[0.75, 0.25])
            hr[i] = np.random.normal(118, 15)
            sys_bp[i] = np.random.normal(88, 12)
            dia_bp[i] = np.random.normal(56, 10)
            rr[i] = np.random.normal(26, 4)
            spo2[i] = np.random.normal(91, 3)
            wbc[i] = np.random.choice([np.random.normal(18000, 4000), np.random.normal(3200, 600)], p=[0.8, 0.2])
            lactate[i] = np.random.normal(3.8, 1.2)
            gcs[i] = np.random.choice([10, 11, 12, 13, 14], p=[0.1, 0.2, 0.3, 0.2, 0.2])
            platelets[i] = np.random.normal(95000, 25000)
            crp[i] = np.random.normal(110.0, 35.0)

    df = pd.DataFrame({
        'temperature': np.clip(temp, 34.0, 42.0),
        'frequenceCardiaque': np.clip(hr, 40, 180),
        'pressionSystolique': np.clip(sys_bp, 50, 220),
        'pressionDiastolique': np.clip(dia_bp, 30, 130),
        'frequenceRespiratoire': np.clip(rr, 8, 45),
        'saturationO2': np.clip(spo2, 70, 100),
        'leucocytes': np.clip(wbc, 1000, 40000),
        'lactate': np.clip(lactate, 0.4, 12.0),
        'scoreGlasgow': np.clip(gcs, 3, 15),
        'plaquettes': np.clip(platelets, 10000, 600000),
        'crp': np.clip(crp, 0.1, 300.0),
        'age': age,
        'sexe': sex,
        'target': y
    })
    return df


def generate_malaria_dataset(n_samples: int = 2000, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    y = np.random.choice([0, 1], size=n_samples, p=[0.60, 0.40])
    
    temp = np.zeros(n_samples)
    hr = np.zeros(n_samples)
    age = np.random.randint(1, 80, size=n_samples)
    tdr = np.zeros(n_samples)
    platelets = np.zeros(n_samples)
    hb = np.zeros(n_samples)
    sex = np.random.choice([0, 1], size=n_samples)
    duration = np.zeros(n_samples)

    for i in range(n_samples):
        if y[i] == 0:  # Negative / Low risk
            temp[i] = np.random.normal(37.0, 0.6)
            hr[i] = np.random.normal(76, 12)
            tdr[i] = np.random.choice([0, 1], p=[0.97, 0.03])
            platelets[i] = np.random.normal(240000, 50000)
            hb[i] = np.random.normal(13.5, 1.5)
            duration[i] = np.random.randint(1, 4)
        else:  # Positive / High risk
            temp[i] = np.random.normal(39.2, 0.7)
            hr[i] = np.random.normal(108, 14)
            tdr[i] = np.random.choice([0, 1], p=[0.05, 0.95])
            platelets[i] = np.random.normal(105000, 35000)
            hb[i] = np.random.normal(10.2, 2.0)
            duration[i] = np.random.randint(2, 10)

    df = pd.DataFrame({
        'temperature': np.clip(temp, 35.0, 42.0),
        'frequenceCardiaque': np.clip(hr, 50, 170),
        'age': age,
        'tdrMalaria': tdr,
        'plaquettes': np.clip(platelets, 15000, 500000),
        'hemoglobine': np.clip(hb, 5.0, 18.0),
        'sexe': sex,
        'dureeSymptomesJours': duration,
        'target': y
    })
    return df


def generate_readmission_dataset(n_samples: int = 2000, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    y = np.random.choice([0, 1], size=n_samples, p=[0.70, 0.30])
    
    age = np.zeros(n_samples)
    recent_hosp = np.zeros(n_samples)
    length_stay = np.zeros(n_samples)
    comorbidities = np.zeros(n_samples)
    gcs = np.zeros(n_samples)
    bmi = np.zeros(n_samples)
    autonomy = np.zeros(n_samples)

    for i in range(n_samples):
        if y[i] == 0:
            age[i] = np.random.normal(52, 15)
            recent_hosp[i] = np.random.choice([0, 1, 2], p=[0.75, 0.20, 0.05])
            length_stay[i] = np.random.normal(3, 1.5)
            comorbidities[i] = np.random.choice([0, 1, 2], p=[0.50, 0.35, 0.15])
            gcs[i] = 15
            bmi[i] = np.random.normal(24.5, 4.0)
            autonomy[i] = np.random.normal(90, 10)
        else:
            age[i] = np.random.normal(68, 12)
            recent_hosp[i] = np.random.choice([1, 2, 3, 4], p=[0.20, 0.40, 0.25, 0.15])
            length_stay[i] = np.random.normal(8, 4.0)
            comorbidities[i] = np.random.choice([2, 3, 4, 5], p=[0.30, 0.40, 0.20, 0.10])
            gcs[i] = np.random.choice([13, 14, 15], p=[0.1, 0.3, 0.6])
            bmi[i] = np.random.normal(29.0, 5.5)
            autonomy[i] = np.random.normal(55, 20)

    df = pd.DataFrame({
        'age': np.clip(age, 18, 98),
        'nbHospitalisationsRecentes': np.clip(recent_hosp, 0, 10),
        'dureeSejourJours': np.clip(length_stay, 1, 45),
        'comorbiditesCount': np.clip(comorbidities, 0, 10),
        'scoreGlasgow': np.clip(gcs, 3, 15),
        'bmi': np.clip(bmi, 14.0, 50.0),
        'autonomie': np.clip(autonomy, 10, 100),
        'target': y
    })
    return df


def generate_cardiovascular_dataset(n_samples: int = 2000, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    y = np.random.choice([0, 1], size=n_samples, p=[0.65, 0.35])
    
    sys_bp = np.zeros(n_samples)
    dia_bp = np.zeros(n_samples)
    hr = np.zeros(n_samples)
    age = np.zeros(n_samples)
    bmi = np.zeros(n_samples)
    diabetes = np.zeros(n_samples)
    smoking = np.zeros(n_samples)
    cholesterol = np.zeros(n_samples)

    for i in range(n_samples):
        if y[i] == 0:
            sys_bp[i] = np.random.normal(122, 12)
            dia_bp[i] = np.random.normal(78, 8)
            hr[i] = np.random.normal(74, 10)
            age[i] = np.random.normal(48, 14)
            bmi[i] = np.random.normal(24.0, 3.5)
            diabetes[i] = np.random.choice([0, 1], p=[0.88, 0.12])
            smoking[i] = np.random.choice([0, 1], p=[0.75, 0.25])
            cholesterol[i] = np.random.normal(4.8, 0.8)
        else:
            sys_bp[i] = np.random.normal(158, 20)
            dia_bp[i] = np.random.normal(98, 12)
            hr[i] = np.random.normal(98, 16)
            age[i] = np.random.normal(64, 11)
            bmi[i] = np.random.normal(31.5, 5.0)
            diabetes[i] = np.random.choice([0, 1], p=[0.45, 0.55])
            smoking[i] = np.random.choice([0, 1], p=[0.40, 0.60])
            cholesterol[i] = np.random.normal(6.5, 1.2)

    df = pd.DataFrame({
        'pressionSystolique': np.clip(sys_bp, 70, 240),
        'pressionDiastolique': np.clip(dia_bp, 40, 140),
        'frequenceCardiaque': np.clip(hr, 45, 180),
        'age': np.clip(age, 18, 95),
        'bmi': np.clip(bmi, 15.0, 55.0),
        'diabete': diabetes,
        'tabagisme': smoking,
        'cholesterol': np.clip(cholesterol, 2.5, 12.0),
        'target': y
    })
    return df


def generate_lab_anomaly_dataset(n_samples: int = 2000, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    y = np.random.choice([0, 1], size=n_samples, p=[0.60, 0.40])
    
    creat = np.zeros(n_samples)
    wbc = np.zeros(n_samples)
    platelets = np.zeros(n_samples)
    bili = np.zeros(n_samples)
    crp = np.zeros(n_samples)
    hb = np.zeros(n_samples)
    potassium = np.zeros(n_samples)
    sodium = np.zeros(n_samples)

    for i in range(n_samples):
        if y[i] == 0:  # Normal lab profile
            creat[i] = np.random.normal(80, 15)
            wbc[i] = np.random.normal(6800, 1200)
            platelets[i] = np.random.normal(260000, 45000)
            bili[i] = np.random.normal(11, 3)
            crp[i] = np.random.normal(3.5, 1.5)
            hb[i] = np.random.normal(14.0, 1.2)
            potassium[i] = np.random.normal(4.2, 0.3)
            sodium[i] = np.random.normal(140, 3)
        else:  # Lab Anomaly profile
            creat[i] = np.random.normal(185, 65)
            wbc[i] = np.random.choice([np.random.normal(17500, 4000), np.random.normal(2800, 500)], p=[0.8, 0.2])
            platelets[i] = np.random.normal(85000, 30000)
            bili[i] = np.random.normal(45, 20)
            crp[i] = np.random.normal(95, 40)
            hb[i] = np.random.normal(9.5, 2.2)
            potassium[i] = np.random.choice([np.random.normal(2.9, 0.3), np.random.normal(5.9, 0.5)], p=[0.5, 0.5])
            sodium[i] = np.random.normal(128, 6)

    df = pd.DataFrame({
        'creatinine': np.clip(creat, 30, 800),
        'leucocytes': np.clip(wbc, 800, 50000),
        'plaquettes': np.clip(platelets, 8000, 650000),
        'bilirubine': np.clip(bili, 2, 250),
        'crp': np.clip(crp, 0.1, 400),
        'hemoglobine': np.clip(hb, 4.0, 20.0),
        'potassium': np.clip(potassium, 1.5, 8.0),
        'natremie': np.clip(sodium, 110, 160),
        'target': y
    })
    return df
