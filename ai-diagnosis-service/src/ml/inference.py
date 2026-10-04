import os
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import pandas as pd
import joblib

SAVED_MODELS_DIR = os.path.join(os.path.dirname(__file__), "saved_models")

DEFAULT_FEATURE_VALUES: Dict[str, float] = {
    "temperature": 37.0,
    "frequenceCardiaque": 75.0,
    "pressionSystolique": 120.0,
    "pressionDiastolique": 80.0,
    "frequenceRespiratoire": 16.0,
    "saturationO2": 98.0,
    "leucocytes": 7000.0,
    "lactate": 1.0,
    "scoreGlasgow": 15.0,
    "plaquettes": 250000.0,
    "crp": 3.0,
    "age": 45.0,
    "sexe": 1.0,
    "tdrMalaria": 0.0,
    "hemoglobine": 13.5,
    "dureeSymptomesJours": 2.0,
    "nbHospitalisationsRecentes": 0.0,
    "dureeSejourJours": 3.0,
    "comorbiditesCount": 0.0,
    "bmi": 24.0,
    "autonomie": 90.0,
    "diabete": 0.0,
    "tabagisme": 0.0,
    "cholesterol": 4.8,
    "creatinine": 85.0,
    "bilirubine": 12.0,
    "potassium": 4.2,
    "natremie": 140.0
}


class InferenceEngine:
    def __init__(self, models_dir: str = SAVED_MODELS_DIR):
        self.models_dir = models_dir
        self.models: Dict[str, Any] = {}
        self.metadata: Dict[str, Dict[str, Any]] = {}
        self._load_all_models()

    def _load_all_models(self):
        if not os.path.exists(self.models_dir):
            return

        for fname in os.listdir(self.models_dir):
            if fname.endswith("_meta.json"):
                meta_path = os.path.join(self.models_dir, fname)
                with open(meta_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                
                model_name = meta["nomModele"]
                self.metadata[model_name] = meta
                
                joblib_name = meta.get("model_file", f"{model_name}.joblib")
                joblib_path = os.path.join(self.models_dir, joblib_name)
                if os.path.exists(joblib_path):
                    self.models[model_name] = joblib.load(joblib_path)

    def reload(self):
        self.models.clear()
        self.metadata.clear()
        self._load_all_models()

    def list_available_models(self) -> List[Dict[str, Any]]:
        return list(self.metadata.values())

    def predict(
        self,
        nom_modele: str,
        patient_id: str,
        encounter_id: Optional[str] = None,
        input_features: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if nom_modele not in self.models or nom_modele not in self.metadata:
            raise ValueError(f"Modèle non trouvé ou non initialisé : '{nom_modele}'")

        model = self.models[nom_modele]
        meta = self.metadata[nom_modele]
        feature_names: List[str] = meta["features"]

        features_dict = input_features or {}
        
        # Prepare vector in exact order expected by scikit-learn model
        vector = []
        full_feature_record = {}
        for feat in feature_names:
            val = features_dict.get(feat)
            if val is None:
                val = DEFAULT_FEATURE_VALUES.get(feat, 0.0)
            else:
                try:
                    val = float(val)
                except (ValueError, TypeError):
                    val = DEFAULT_FEATURE_VALUES.get(feat, 0.0)
            vector.append(val)
            full_feature_record[feat] = val

        X = pd.DataFrame([vector], columns=feature_names)
        
        # Inferences
        pred_class = int(model.predict(X)[0])
        probabilities = model.predict_proba(X)[0]
        
        # Leaf probability confidence score
        if len(probabilities) > pred_class:
            prob = float(probabilities[pred_class])
        else:
            prob = float(probabilities[-1])

        prob = round(prob, 4)

        # Explainability & Risk Level computation
        risk_level, diag_title, factors, recommendations, snomed_code, fhir_risk_code = self._explain_prediction(
            nom_modele, pred_class, prob, full_feature_record
        )

        inference_id = f"inf-{uuid.uuid4()}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # Build FHIR RiskAssessment
        fhir_resource = {
            "resourceType": "RiskAssessment",
            "id": f"risk-{inference_id}",
            "status": "final",
            "subject": {"reference": f"Patient/{patient_id}"},
            "occurrenceDateTime": now_iso,
            "prediction": [
                {
                    "outcome": {
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": snomed_code,
                                "display": diag_title
                            }
                        ],
                        "text": diag_title
                    },
                    "probabilityDecimal": prob,
                    "qualitativeRisk": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/risk-probability",
                                "code": fhir_risk_code,
                                "display": f"{risk_level} risk"
                            }
                        ]
                    },
                    "rationale": f"Score basé sur l'analyse des symptômes: {', '.join([f['feature'] + '=' + str(f['valeur']) for f in factors[:3]])}"
                }
            ]
        }

        if encounter_id:
            fhir_resource["encounter"] = {"reference": f"Encounter/{encounter_id}"}

        response = {
            "success": True,
            "inferenceId": inference_id,
            "timestamp": now_iso,
            "nomModele": nom_modele,
            "modelVersion": meta.get("version", "1.0.0"),
            "patientId": patient_id,
            "prediction": {
                "scoreProbabilite": prob,
                "niveauRisque": risk_level,
                "intituleDiagnostic": diag_title,
                "facteursContributifs": factors,
                "recommandations": recommendations
            },
            "fhirResource": fhir_resource
        }

        return response, full_feature_record

    def _explain_prediction(
        self,
        nom_modele: str,
        pred_class: int,
        prob: float,
        feats: Dict[str, float]
    ) -> Tuple[str, str, List[Dict[str, Any]], List[str], str, str]:
        factors = []
        recommendations = []
        snomed_code = "410605003"
        fhir_risk_code = "low"
        risk_level = "LOW"
        diag_title = "Risque Faible"

        if nom_modele == "sepsis-risk-v1":
            snomed_code = "91302008"
            temp = feats.get("temperature", 37.0)
            sys_bp = feats.get("pressionSystolique", 120.0)
            hr = feats.get("frequenceCardiaque", 75.0)
            rr = feats.get("frequenceRespiratoire", 16.0)
            wbc = feats.get("leucocytes", 7000.0)
            lactate = feats.get("lactate", 1.0)
            gcs = feats.get("scoreGlasgow", 15.0)
            spo2 = feats.get("saturationO2", 98.0)
            crp = feats.get("crp", 3.0)
            plat = feats.get("plaquettes", 250000.0)

            if temp > 38.3:
                factors.append({"feature": "temperature", "valeur": temp, "impact": "HIGH", "explication": f"Hyperthermie majeure ({temp}°C > 38.3°C)"})
            elif temp < 36.0:
                factors.append({"feature": "temperature", "valeur": temp, "impact": "CRITICAL", "explication": f"Hypothermie critique ({temp}°C < 36.0°C)"})

            if sys_bp <= 90:
                factors.append({"feature": "pressionSystolique", "valeur": sys_bp, "impact": "CRITICAL", "explication": f"Hypotension artérielle systolique ({sys_bp} mmHg <= 90 mmHg)"})
            elif sys_bp < 100:
                factors.append({"feature": "pressionSystolique", "valeur": sys_bp, "impact": "MODERATE", "explication": f"Pression systolique limite ({sys_bp} mmHg)"})

            if hr > 90:
                factors.append({"feature": "frequenceCardiaque", "valeur": hr, "impact": "MODERATE", "explication": f"Tachycardie ({hr} bpm > 90 bpm)"})

            if rr >= 22:
                factors.append({"feature": "frequenceRespiratoire", "valeur": rr, "impact": "HIGH", "explication": f"Tachypnée ({rr} c/min >= 22) — critère qSOFA"})

            if spo2 < 90:
                factors.append({"feature": "saturationO2", "valeur": spo2, "impact": "CRITICAL", "explication": f"Désaturation sévère (SpO2 {spo2}% < 90%)"})
            elif spo2 < 94:
                factors.append({"feature": "saturationO2", "valeur": spo2, "impact": "HIGH", "explication": f"Hypoxémie (SpO2 {spo2}% < 94%)"})

            if wbc > 12000:
                factors.append({"feature": "leucocytes", "valeur": wbc, "impact": "MODERATE", "explication": f"Hyperleucocytose ({wbc} /mm³)"})
            elif wbc < 4000:
                factors.append({"feature": "leucocytes", "valeur": wbc, "impact": "HIGH", "explication": f"Leucopénie ({wbc} /mm³)"})

            if lactate > 4.0:
                factors.append({"feature": "lactate", "valeur": lactate, "impact": "CRITICAL", "explication": f"Hyperlactatémie sévère ({lactate} mmol/L > 4.0) — choc"})
            elif lactate > 2.0:
                factors.append({"feature": "lactate", "valeur": lactate, "impact": "HIGH", "explication": f"Hyperlactatémie ({lactate} mmol/L)"})

            if gcs < 13:
                factors.append({"feature": "scoreGlasgow", "valeur": gcs, "impact": "CRITICAL", "explication": f"Altération sévère de la conscience (GCS {gcs} < 13)"})
            elif gcs < 15:
                factors.append({"feature": "scoreGlasgow", "valeur": gcs, "impact": "HIGH", "explication": f"Altération de la conscience (GCS {gcs} < 15)"})

            if crp > 100:
                factors.append({"feature": "crp", "valeur": crp, "impact": "HIGH", "explication": f"Syndrome inflammatoire majeur (CRP {crp} mg/L > 100)"})
            elif crp > 50:
                factors.append({"feature": "crp", "valeur": crp, "impact": "MODERATE", "explication": f"Syndrome inflammatoire (CRP {crp} mg/L)"})

            if plat < 100000:
                factors.append({"feature": "plaquettes", "valeur": plat, "impact": "HIGH", "explication": f"Thrombopénie sévère ({plat} /mm³) — CIVD possible"})
            elif plat < 150000:
                factors.append({"feature": "plaquettes", "valeur": plat, "impact": "MODERATE", "explication": f"Thrombopénie modérée ({plat} /mm³)"})

            if pred_class == 2 or sys_bp <= 90 or lactate > 3.0:
                risk_level = "CRITICAL" if (sys_bp <= 85 or lactate > 4.0) else "HIGH"
                fhir_risk_code = "high"
                diag_title = "Risque Élevé de Sepsis / Choc Septique"
                recommendations = [
                    "Placer le patient sous surveillance continue des constantes vitales.",
                    "Réaliser un bilan de lactatémie et des hémocultures en urgence.",
                    "Envisager un remplissage vasculaire et un avis de réanimation immédiat.",
                    "Administrer l'antibiothérapie probabiliste dans l'heure (bundle Sepsis-3)."
                ]
            elif pred_class == 1 or len(factors) >= 2:
                risk_level = "MODERATE"
                fhir_risk_code = "moderate"
                diag_title = "Risque Modéré de Sepsis"
                recommendations = [
                    "Réévaluer les constantes vitales toutes les 2 heures.",
                    "Prescrire un bilan biologique sanguin et inflammatoire complet (NFS, CRP, lactate).",
                    "Monitorer la diurèse et la conscience (GCS)."
                ]
            else:
                risk_level = "LOW"
                fhir_risk_code = "low"
                diag_title = "Risque Faible de Sepsis"
                recommendations = ["Surveillance clinique standard. Réévaluer si aggravation."]

        elif nom_modele == "malaria-risk-v1":
            snomed_code = "61462000"
            temp = feats.get("temperature", 37.0)
            tdr = feats.get("tdrMalaria", 0.0)
            hr = feats.get("frequenceCardiaque", 75.0)
            plat = feats.get("plaquettes", 250000.0)
            hb = feats.get("hemoglobine", 13.5)
            duree = feats.get("dureeSymptomesJours", 2.0)

            if tdr == 1.0:
                factors.append({"feature": "tdrMalaria", "valeur": 1, "impact": "CRITICAL", "explication": "Test de Diagnostic Rapide (TDR) Paludisme Positif"})
            if temp >= 38.5:
                factors.append({"feature": "temperature", "valeur": temp, "impact": "HIGH", "explication": f"Fièvre élevée ({temp}°C >= 38.5°C)"})
            elif temp >= 37.5:
                factors.append({"feature": "temperature", "valeur": temp, "impact": "MODERATE", "explication": f"Fièvre modérée ({temp}°C)"})
            if hr >= 110:
                factors.append({"feature": "frequenceCardiaque", "valeur": hr, "impact": "HIGH", "explication": f"Tachycardie sévère ({hr} bpm) — retentissement hémodynamique"})
            elif hr >= 100:
                factors.append({"feature": "frequenceCardiaque", "valeur": hr, "impact": "MODERATE", "explication": f"Tachycardie ({hr} bpm)"})
            if plat < 80000:
                factors.append({"feature": "plaquettes", "valeur": plat, "impact": "CRITICAL", "explication": f"Thrombopénie sévère ({plat} /mm³) — paludisme grave"})
            elif plat < 150000:
                factors.append({"feature": "plaquettes", "valeur": plat, "impact": "HIGH", "explication": f"Thrombopénie associée ({plat} /mm³)"})
            if hb < 8.0:
                factors.append({"feature": "hemoglobine", "valeur": hb, "impact": "CRITICAL", "explication": f"Anémie sévère ({hb} g/dL) — paludisme grave"})
            elif hb < 11.0:
                factors.append({"feature": "hemoglobine", "valeur": hb, "impact": "MODERATE", "explication": f"Anémie palustre ({hb} g/dL)"})
            if duree >= 5:
                factors.append({"feature": "dureeSymptomesJours", "valeur": duree, "impact": "MODERATE", "explication": f"Symptômes prolongés ({duree} jours >= 5 jours)"})

            if pred_class == 1 or tdr == 1.0 or temp >= 39.0:
                risk_level = "HIGH"
                fhir_risk_code = "high"
                diag_title = "Probabilité Élevée de Paludisme"
                recommendations = [
                    "Effectuer une Goutte Épaisse (GE) / Frottis sanguin de confirmation.",
                    "Initier le traitement antipaludique selon le protocole national si confirmé.",
                    "Surveiller les signes de paludisme grave (anémie, troubles de conscience, insuffisance rénale).",
                    "Contrôler la glycémie (risque d'hypoglycémie sous quinine)."
                ]
            else:
                risk_level = "LOW"
                fhir_risk_code = "low"
                diag_title = "Probabilité Faible de Paludisme"
                recommendations = [
                    "Rechercher d'autres étiologies à la fièvre si symptômes persistants.",
                    "Recontrôler le TDR à 48h si la fièvre persiste."
                ]

        elif nom_modele == "readmission-risk-v1":
            snomed_code = "410605003"
            hosp = feats.get("nbHospitalisationsRecentes", 0.0)
            stay = feats.get("dureeSejourJours", 3.0)
            comorb = feats.get("comorbiditesCount", 0.0)
            auton = feats.get("autonomie", 90.0)
            gcs = feats.get("scoreGlasgow", 15.0)
            bmi = feats.get("bmi", 24.0)
            age = feats.get("age", 45.0)

            if hosp >= 2:
                factors.append({"feature": "nbHospitalisationsRecentes", "valeur": hosp, "impact": "HIGH", "explication": f"Réhospitalisations multiples récentes ({int(hosp)} hospitalisations)"})
            if stay >= 14:
                factors.append({"feature": "dureeSejourJours", "valeur": stay, "impact": "HIGH", "explication": f"Séjour très prolongé ({stay} jours >= 14 jours)"})
            elif stay >= 7:
                factors.append({"feature": "dureeSejourJours", "valeur": stay, "impact": "MODERATE", "explication": f"Durée de séjour prolongée ({stay} jours)"})
            if comorb >= 4:
                factors.append({"feature": "comorbiditesCount", "valeur": comorb, "impact": "HIGH", "explication": f"Polypathologie complexe ({int(comorb)} comorbidités)"})
            elif comorb >= 3:
                factors.append({"feature": "comorbiditesCount", "valeur": comorb, "impact": "MODERATE", "explication": f"Comorbidités multiples ({int(comorb)})"})
            if auton < 40:
                factors.append({"feature": "autonomie", "valeur": auton, "impact": "HIGH", "explication": f"Perte d'autonomie sévère ({auton}%)"})
            elif auton < 60:
                factors.append({"feature": "autonomie", "valeur": auton, "impact": "MODERATE", "explication": f"Perte d'autonomie ({auton}%)"})
            if gcs < 14:
                factors.append({"feature": "scoreGlasgow", "valeur": gcs, "impact": "MODERATE", "explication": f"Altération cognitive à la sortie (GCS {gcs})"})
            if bmi >= 35:
                factors.append({"feature": "bmi", "valeur": bmi, "impact": "MODERATE", "explication": f"Obésité morbide (IMC {bmi} kg/m²)"})
            if age >= 80:
                factors.append({"feature": "age", "valeur": age, "impact": "MODERATE", "explication": f"Grand âge ({int(age)} ans >= 80 ans)"})
            elif age >= 75:
                factors.append({"feature": "age", "valeur": age, "impact": "LOW", "explication": f"Âge avancé ({int(age)} ans)"})

            if pred_class == 1 or hosp >= 2 or comorb >= 4:
                risk_level = "HIGH"
                fhir_risk_code = "high"
                diag_title = "Risque Élevé de Réhospitalisation à 30 jours"
                recommendations = [
                    "Planifier un suivi ambulatoire renforcé post-sortie dans les 7 jours.",
                    "Organiser la conciliation médicamenteuse avec le pharmacien.",
                    "Impliquer les services de soins à domicile / HAD.",
                    "Mettre en place un plan personnalisé de sortie (PPS) avec le patient et ses aidants."
                ]
            else:
                risk_level = "LOW"
                fhir_risk_code = "low"
                diag_title = "Risque Faible de Réhospitalisation"
                recommendations = [
                    "Suivi médical habituel en médecine de ville.",
                    "Remettre au patient les consignes de retour aux urgences en cas d'aggravation."
                ]

        elif nom_modele == "cardiovascular-risk-v1":
            snomed_code = "49436004"
            sys_bp = feats.get("pressionSystolique", 120.0)
            dia_bp = feats.get("pressionDiastolique", 80.0)
            hr = feats.get("frequenceCardiaque", 75.0)
            bmi = feats.get("bmi", 24.0)
            diabete = feats.get("diabete", 0.0)
            tabagisme = feats.get("tabagisme", 0.0)
            cholesterol = feats.get("cholesterol", 4.8)
            age = feats.get("age", 45.0)

            if sys_bp >= 160:
                factors.append({"feature": "pressionSystolique", "valeur": sys_bp, "impact": "CRITICAL", "explication": f"Hypertension systolique de grade 2/3 ({sys_bp} mmHg)"})
            elif sys_bp >= 140:
                factors.append({"feature": "pressionSystolique", "valeur": sys_bp, "impact": "HIGH", "explication": f"Hypertension systolique ({sys_bp} mmHg)"})
            if dia_bp >= 100:
                factors.append({"feature": "pressionDiastolique", "valeur": dia_bp, "impact": "CRITICAL", "explication": f"Hypertension diastolique sévère ({dia_bp} mmHg)"})
            elif dia_bp >= 90:
                factors.append({"feature": "pressionDiastolique", "valeur": dia_bp, "impact": "HIGH", "explication": f"Hypertension diastolique ({dia_bp} mmHg)"})
            if hr >= 110:
                factors.append({"feature": "frequenceCardiaque", "valeur": hr, "impact": "HIGH", "explication": f"Tachycardie marquée ({hr} bpm)"})
            elif hr >= 100:
                factors.append({"feature": "frequenceCardiaque", "valeur": hr, "impact": "MODERATE", "explication": f"Tachycardie ({hr} bpm)"})
            if bmi >= 35:
                factors.append({"feature": "bmi", "valeur": bmi, "impact": "HIGH", "explication": f"Obésité morbide (IMC {bmi} kg/m²)"})
            elif bmi >= 30:
                factors.append({"feature": "bmi", "valeur": bmi, "impact": "MODERATE", "explication": f"Obésité (IMC {bmi} kg/m²)"})
            if diabete == 1.0:
                factors.append({"feature": "diabete", "valeur": 1, "impact": "MODERATE", "explication": "Diabète — facteur de risque cardiovasculaire majeur"})
            if tabagisme == 1.0:
                factors.append({"feature": "tabagisme", "valeur": 1, "impact": "MODERATE", "explication": "Tabagisme actif — facteur de risque cardiovasculaire"})
            if cholesterol >= 7.0:
                factors.append({"feature": "cholesterol", "valeur": cholesterol, "impact": "HIGH", "explication": f"Hypercholestérolémie sévère ({cholesterol} mmol/L)"})
            elif cholesterol >= 6.0:
                factors.append({"feature": "cholesterol", "valeur": cholesterol, "impact": "MODERATE", "explication": f"Hypercholestérolémie ({cholesterol} mmol/L)"})
            if age >= 65:
                factors.append({"feature": "age", "valeur": age, "impact": "MODERATE", "explication": f"Âge élevé ({int(age)} ans) — facteur de risque cardiovasculaire"})

            if pred_class == 1 or sys_bp >= 160 or dia_bp >= 100:
                risk_level = "HIGH"
                fhir_risk_code = "high"
                diag_title = "Risque Cardiovasculaire Élevé"
                recommendations = [
                    "Réaliser un ECG de repos immédiatement.",
                    "Adapter le traitement antihypertenseur et référer en cardiologie.",
                    "Contrôler les enzymes cardiaques (troponine) en cas de douleur thoracique.",
                    "Évaluer le score de risque cardiovasculaire global (SCORE2)."
                ]
            else:
                risk_level = "LOW"
                fhir_risk_code = "low"
                diag_title = "Risque Cardiovasculaire Modéré / Faible"
                recommendations = [
                    "Conseils hygiéno-diététiques et contrôle tensionnel périodique.",
                    "Bilan lipidique et glycémique annuel recommandé."
                ]

        elif nom_modele == "lab-anomaly-detection-v1":
            snomed_code = "166312007"
            creat = feats.get("creatinine", 85.0)
            bili = feats.get("bilirubine", 12.0)
            crp = feats.get("crp", 3.0)
            wbc = feats.get("leucocytes", 7000.0)
            plat = feats.get("plaquettes", 250000.0)
            hb = feats.get("hemoglobine", 13.5)
            potassium = feats.get("potassium", 4.2)
            natremie = feats.get("natremie", 140.0)

            if creat > 300:
                factors.append({"feature": "creatinine", "valeur": creat, "impact": "CRITICAL", "explication": f"Insuffisance rénale sévère ({creat} µmol/L > 300)"})
            elif creat > 130:
                factors.append({"feature": "creatinine", "valeur": creat, "impact": "HIGH", "explication": f"Créatininémie élevée ({creat} µmol/L) — suspicion insuffisance rénale"})
            if bili > 100:
                factors.append({"feature": "bilirubine", "valeur": bili, "impact": "CRITICAL", "explication": f"Hyperbilirubinémie majeure ({bili} µmol/L) — ictère sévère"})
            elif bili > 35:
                factors.append({"feature": "bilirubine", "valeur": bili, "impact": "HIGH", "explication": f"Hyperbilirubinémie ({bili} µmol/L) — suspicion atteinte hépatique/ictère"})
            if crp > 150:
                factors.append({"feature": "crp", "valeur": crp, "impact": "CRITICAL", "explication": f"Syndrome inflammatoire très sévère (CRP {crp} mg/L > 150)"})
            elif crp > 50:
                factors.append({"feature": "crp", "valeur": crp, "impact": "HIGH", "explication": f"CRP très élevée ({crp} mg/L) — syndrome inflammatoire sévère"})
            if plat < 50000:
                factors.append({"feature": "plaquettes", "valeur": plat, "impact": "CRITICAL", "explication": f"Thrombopénie critique ({plat} /mm³) — risque hémorragique majeur"})
            elif plat < 100000:
                factors.append({"feature": "plaquettes", "valeur": plat, "impact": "HIGH", "explication": f"Thrombopénie marquée ({plat} /mm³)"})
            if wbc > 20000:
                factors.append({"feature": "leucocytes", "valeur": wbc, "impact": "HIGH", "explication": f"Hyperleucocytose majeure ({wbc} /mm³) — sepsis / hémopathie ?"})
            elif wbc > 12000:
                factors.append({"feature": "leucocytes", "valeur": wbc, "impact": "MODERATE", "explication": f"Hyperleucocytose ({wbc} /mm³)"})
            elif wbc < 2000:
                factors.append({"feature": "leucocytes", "valeur": wbc, "impact": "CRITICAL", "explication": f"Leucopénie sévère ({wbc} /mm³) — aplasie / immunodépression ?"})
            elif wbc < 4000:
                factors.append({"feature": "leucocytes", "valeur": wbc, "impact": "HIGH", "explication": f"Leucopénie ({wbc} /mm³)"})
            if hb < 7.0:
                factors.append({"feature": "hemoglobine", "valeur": hb, "impact": "CRITICAL", "explication": f"Anémie sévère ({hb} g/dL < 7.0) — transfusion à envisager"})
            elif hb < 10.0:
                factors.append({"feature": "hemoglobine", "valeur": hb, "impact": "HIGH", "explication": f"Anémie significative ({hb} g/dL)"})
            if potassium > 6.0:
                factors.append({"feature": "potassium", "valeur": potassium, "impact": "CRITICAL", "explication": f"Hyperkaliémie sévère ({potassium} mmol/L) — risque arythmie"})
            elif potassium > 5.5:
                factors.append({"feature": "potassium", "valeur": potassium, "impact": "HIGH", "explication": f"Hyperkaliémie ({potassium} mmol/L)"})
            elif potassium < 2.5:
                factors.append({"feature": "potassium", "valeur": potassium, "impact": "CRITICAL", "explication": f"Hypokaliémie sévère ({potassium} mmol/L) — risque arythmie"})
            elif potassium < 3.0:
                factors.append({"feature": "potassium", "valeur": potassium, "impact": "HIGH", "explication": f"Hypokaliémie ({potassium} mmol/L)"})
            if natremie > 155:
                factors.append({"feature": "natremie", "valeur": natremie, "impact": "CRITICAL", "explication": f"Hypernatrémie sévère ({natremie} mmol/L)"})
            elif natremie > 150:
                factors.append({"feature": "natremie", "valeur": natremie, "impact": "HIGH", "explication": f"Hypernatrémie ({natremie} mmol/L)"})
            elif natremie < 120:
                factors.append({"feature": "natremie", "valeur": natremie, "impact": "CRITICAL", "explication": f"Hyponatrémie sévère ({natremie} mmol/L) — risque neurologique"})
            elif natremie < 130:
                factors.append({"feature": "natremie", "valeur": natremie, "impact": "HIGH", "explication": f"Hyponatrémie ({natremie} mmol/L)"})

            if pred_class == 1 or len(factors) > 0:
                risk_level = "HIGH"
                fhir_risk_code = "high"
                diag_title = "Anomalies Biologiques Majeures Détectées"
                recommendations = [
                    "Contrôler les bilans d'organes cibles (fonction rénale, bilan hépatique, hémostase).",
                    "Avis spécialisé recommandé selon le profil d'organes touchés.",
                    "Surveiller l'ionogramme sanguin et corriger les troubles électrolytiques.",
                    "Réévaluer le traitement médicamenteux en cours (néphrotoxiques, hépatotoxiques)."
                ]
            else:
                risk_level = "LOW"
                fhir_risk_code = "low"
                diag_title = "Profil Biologique Dans Les Limites Normales"
                recommendations = ["Aucune action biologique urgente requise. Recontrôler selon l'évolution clinique."]

        return risk_level, diag_title, factors, recommendations, snomed_code, fhir_risk_code
