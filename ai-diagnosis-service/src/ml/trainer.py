import os
import json
import joblib
from typing import Dict, Any, Tuple
import pandas as pd
from sklearn.tree import DecisionTreeClassifier

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

from src.ml.dataset_generator import (
    generate_sepsis_dataset,
    generate_malaria_dataset,
    generate_readmission_dataset,
    generate_cardiovascular_dataset,
    generate_lab_anomaly_dataset
)

SAVED_MODELS_DIR = os.path.join(os.path.dirname(__file__), "saved_models")


MODEL_CONFIGS: Dict[str, Dict[str, Any]] = {
    "sepsis-risk-v1": {
        "version": "1.2.0",
        "generator": generate_sepsis_dataset,
        "max_depth": 5,
        "features": [
            "temperature", "frequenceCardiaque", "pressionSystolique", "pressionDiastolique",
            "frequenceRespiratoire", "saturationO2", "leucocytes", "lactate",
            "scoreGlasgow", "plaquettes", "crp", "age", "sexe"
        ]
    },
    "malaria-risk-v1": {
        "version": "1.1.0",
        "generator": generate_malaria_dataset,
        "max_depth": 4,
        "features": [
            "temperature", "frequenceCardiaque", "age", "tdrMalaria",
            "plaquettes", "hemoglobine", "sexe", "dureeSymptomesJours"
        ]
    },
    "readmission-risk-v1": {
        "version": "1.0.0",
        "generator": generate_readmission_dataset,
        "max_depth": 4,
        "features": [
            "age", "nbHospitalisationsRecentes", "dureeSejourJours", "comorbiditesCount",
            "scoreGlasgow", "bmi", "autonomie"
        ]
    },
    "cardiovascular-risk-v1": {
        "version": "1.1.0",
        "generator": generate_cardiovascular_dataset,
        "max_depth": 4,
        "features": [
            "pressionSystolique", "pressionDiastolique", "frequenceCardiaque", "age",
            "bmi", "diabete", "tabagisme", "cholesterol"
        ]
    },
    "lab-anomaly-detection-v1": {
        "version": "1.0.0",
        "generator": generate_lab_anomaly_dataset,
        "max_depth": 4,
        "features": [
            "creatinine", "leucocytes", "plaquettes", "bilirubine",
            "crp", "hemoglobine", "potassium", "natremie"
        ]
    }
}


def train_single_model(model_name: str, config: Dict[str, Any], output_dir: str = SAVED_MODELS_DIR) -> Dict[str, Any]:
    os.makedirs(output_dir, exist_ok=True)
    
    generator = config["generator"]
    df: pd.DataFrame = generator()
    
    feature_cols = config["features"]
    X = df[feature_cols]
    y = df['target']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    clf = DecisionTreeClassifier(
        max_depth=config["max_depth"],
        min_samples_split=10,
        min_samples_leaf=5,
        criterion='entropy',
        class_weight='balanced',
        random_state=42
    )
    
    clf.fit(X_train, y_train)
    
    y_pred = clf.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average='weighted', zero_division=0)
    rec = recall_score(y_test, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
    
    # Calculate feature importances
    importances = {feat: round(float(imp), 4) for feat, imp in zip(feature_cols, clf.feature_importances_)}
    
    model_filepath = os.path.join(output_dir, f"{model_name}.joblib")
    joblib.dump(clf, model_filepath)
    
    metadata = {
        "nomModele": model_name,
        "version": config["version"],
        "max_depth": config["max_depth"],
        "features": feature_cols,
        "classes": [int(c) for c in clf.classes_],
        "metrics": {
            "accuracy": round(float(acc), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "f1_score": round(float(f1), 4)
        },
        "feature_importances": importances,
        "model_file": f"{model_name}.joblib"
    }
    
    meta_filepath = os.path.join(output_dir, f"{model_name}_meta.json")
    with open(meta_filepath, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
        
    print(f"✅ Model [{model_name}] v{config['version']} trained successfully (Acc: {acc:.2%}, F1: {f1:.2%}) -> {model_filepath}")
    return metadata


def train_all_models(output_dir: str = SAVED_MODELS_DIR) -> Dict[str, Dict[str, Any]]:
    results = {}
    for name, config in MODEL_CONFIGS.items():
        results[name] = train_single_model(name, config, output_dir)
    return results


if __name__ == "__main__":
    train_all_models()
