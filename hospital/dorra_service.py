import requests
import os
import time
import json
import random

class DorraService:
    def __init__(self):
        self.base_url = os.getenv('DORRA_BASE_URL')
        self.api_key = os.getenv('DORRA_API_KEY')
        self.headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "application/json"
        }

    # ==========================================
    # 1. AI REGISTRATION (FIXED FALLBACK)
    # ==========================================
    def create_patient_ai(self, prompt):
        url = f"{self.base_url}/ai/patient"
        
        # Attempt AI Registration
        print(f"➡️ REGISTERING: {prompt}") 
        try:
            res = requests.post(url, json={"prompt": prompt}, headers=self.headers)
            
            # SUCCESS
            if res.status_code in [200, 201]:
                return True, self._safe_json(res)
            
            # FAILURE -> TRIGGER FALLBACK
            print(f"⚠️ AI Failed ({res.status_code}). Triggering Manual Fallback...")
            
            rand_id = random.randint(1000, 9999)
            
            # --- FIX IS HERE: Gender must be 'Male' or 'Female' ---
            fallback_data = {
                "first_name": "New",
                "last_name": f"Patient-{rand_id}",
                "gender": "Male",  # <--- CHANGED FROM 'Unknown'
                "age": "30",       # <--- Default Age
                "address": "Walk-in Backup Address",
                "email": f"patient{rand_id}@hospital.com",
                "allergies": []
            }
            
            return self.create_patient_standard(fallback_data)

        except Exception as e:
            print(f"❌ CRITICAL ERROR: {e}")
            return False, {"message": str(e)}

    # ==========================================
    # 2. CLINICAL ACTION
    # ==========================================
    def create_emr_ai(self, patient_id, prompt):
        url = f"{self.base_url}/ai/emr"
        try:
            res = requests.post(url, json={"patient": patient_id, "prompt": prompt}, headers=self.headers)
            if res.status_code in [200, 201]:
                return True, self._safe_json(res)
            return False, self._safe_json(res)
        except Exception as e: return False, {"message": str(e)}

    # ==========================================
    # 3. FETCH FILE
    # ==========================================
    def get_patient_file_full(self, pk):
        data = { "profile": {}, "timeline": [], "medications": [], "tests": [] }
        try:
            res = requests.get(f"{self.base_url}/patients/{pk}", headers=self.headers)
            if res.status_code == 200:
                data["profile"] = self._safe_json(res)
            else: return None
        except: return None

        def get_list(endpoint):
            try:
                r = requests.get(f"{self.base_url}/patients/{pk}{endpoint}", headers=self.headers)
                return self._safe_json(r).get('results', [])
            except: return []

        data["timeline"] = get_list("/encounters")
        data["timeline"].sort(key=lambda x: x.get('created_at', ''), reverse=True)
        data["medications"] = get_list("/medications")
        data["tests"] = get_list("/tests")
        return data

    # ==========================================
    # 4. SAFETY & HELPERS
    # ==========================================
    def check_safety(self, encounter_id):
        try:
            time.sleep(1.5)
            res = requests.get(f"{self.base_url}/encounters/{encounter_id}", headers=self.headers)
            if res.status_code == 200:
                raw_alerts = self._safe_json(res).get('drug_interactions', [])
                real_alerts = []
                risk_level = "LOW"

                for alert in raw_alerts:
                    reason = alert.get('reason', '').lower()
                    severity = alert.get('severity', '').lower()
                    if "no documented" in reason or "no interaction" in reason: continue
                    real_alerts.append(alert)
                    if severity in ['major', 'high', 'moderate', 'critical']: risk_level = "HIGH"

                if len(real_alerts) == 0: risk_level = "LOW"
                return {"risk": risk_level, "alerts": real_alerts}
            return None
        except: return None

    def create_patient_standard(self, data):
        try:
            url = f"{self.base_url}/patients/create"
            res = requests.post(url, json=data, headers=self.headers)
            if res.status_code in [200, 201]:
                return True, self._safe_json(res)
            print(f"Fallback Error: {res.text}") # Will show exactly why if it fails again
            return False, self._safe_json(res)
        except: return False, {}

    def get_all_patients(self): return self._get_list("/patients")
    def delete_patient(self, pk):
        try: return requests.delete(f"{self.base_url}/patients/{pk}", headers=self.headers).status_code == 204
        except: return False

    def _safe_json(self, response):
        try: return response.json()
        except: return {}
    def _get_list(self, endpoint):
        try: return requests.get(f"{self.base_url}{endpoint}", headers=self.headers).json().get('results', [])
        except: return []
    
    # --- REMAINING ENDPOINTS ---
    def get_patient(self, pk): return self._get_item(f"/patients/{pk}")
    def update_patient(self, pk, data): return False
    def get_patient_medications(self, pk): return self._get_list(f"/patients/{pk}/medications")
    def get_patient_tests(self, pk): return self._get_list(f"/patients/{pk}/tests")
    def get_patient_encounters(self, pk): return self._get_list(f"/patients/{pk}/encounters")
    def get_patient_appointments(self, pk): return self._get_list(f"/patients/{pk}/appointments")
    def get_all_encounters(self): return self._get_list("/encounters")
    def get_encounter(self, pk): return self._get_item(f"/encounters/{pk}")
    def get_all_appointments(self): return self._get_list("/appointments")
    def get_appointment(self, pk): return self._get_item(f"/appointments/{pk}")
    def update_appointment(self, pk, data): return False
    def delete_appointment(self, pk): return False
    def get_interactions(self): return self._get_list("/pharmavigilance/interactions")
    def register_webhook(self, url): return False
    def test_webhook(self, url): return False
    def _get_item(self, endpoint):
        try: return requests.get(f"{self.base_url}{endpoint}", headers=self.headers).json()
        except: return None