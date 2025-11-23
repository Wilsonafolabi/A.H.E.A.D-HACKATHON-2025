from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from .models import SafetyIncident
from .dorra_service import DorraService

# 1. LOGIN
class CustomLoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        user = authenticate(username=request.data.get('username'), password=request.data.get('password'))
        if user:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({"token": token.key, "username": user.username})
        return Response({"error": "Invalid Credentials"}, status=400)

# 2. DIRECTORY
class PatientListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(DorraService().get_all_patients())

# 3. FILE VIEW & DELETE
class PatientDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        data = DorraService().get_patient_file_full(pk)
        if data: return Response(data)
        return Response(status=404)

    def delete(self, request, pk):
        if DorraService().delete_patient(pk):
            return Response(status=204)
        return Response(status=400)

# 4. AI ROUTER (Register & Consult)
class AIActionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        service = DorraService()
        prompt = request.data.get('prompt')
        pid = request.data.get('patient_id')

        # If prompt contains "new patient" or "enroll", it is REGISTRATION
        is_registration = any(x in prompt.lower() for x in ['new patient', 'enroll', 'register', 'add patient'])

        if is_registration:
             success, data = service.create_patient_ai(prompt)
             if success:
                 # Return ID to auto-open file
                 return Response({"type": "enroll", "id": data.get('id')}, status=201)
             return Response(data, status=400)
        else:
             # Else it is CONSULTATION
             success, data = service.create_emr_ai(pid, prompt)
             
             safety = None
             if success and data.get('resource') == 'Encounter':
                 new_id = data.get('id')
                 safety = service.check_safety(new_id)
                 if safety and safety['risk'] == 'HIGH':
                     SafetyIncident.objects.create(doctor=request.user, patient_dorra_id=pid, drug_interaction_json=safety['alerts'])

             return Response({"type": "emr", "data": data, "safety": safety}, status=200 if success else 400)