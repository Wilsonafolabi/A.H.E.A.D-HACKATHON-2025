from django.contrib import admin
from django.urls import path
from hospital.views import CustomLoginView, PatientListView, PatientDetailView, AIActionView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/login/', CustomLoginView.as_view()),
    path('api/patients/', PatientListView.as_view()),
    path('api/patients/<int:pk>/file/', PatientDetailView.as_view()),
    path('api/ai/action/', AIActionView.as_view()),
]