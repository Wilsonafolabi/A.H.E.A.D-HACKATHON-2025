from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = (('DOCTOR', 'Doctor'), ('PHARMACIST', 'Pharmacist'), ('ADMIN', 'Admin'))
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='DOCTOR')

class SafetyIncident(models.Model):
    """
    Local Database Table for PharmaVigilance Audit Logs.
    Stores every 'Red Alert' event for legal/compliance reasons.
    """
    doctor = models.ForeignKey(User, on_delete=models.CASCADE)
    patient_dorra_id = models.IntegerField()
    drug_interaction_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Incident: Patient {self.patient_dorra_id} by {self.doctor.username}"