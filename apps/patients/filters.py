import django_filters

from apps.patients.models import Patient


class PatientFilterSet(django_filters.FilterSet):
    dob_from = django_filters.DateFilter(field_name="dob", lookup_expr="gte")
    dob_to = django_filters.DateFilter(field_name="dob", lookup_expr="lte")
    gender = django_filters.CharFilter(field_name="gender")
    status = django_filters.CharFilter(field_name="status")
    blood_group = django_filters.CharFilter(field_name="blood_group", lookup_expr="iexact")
    registered_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    registered_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = Patient
        fields = ["gender", "status", "blood_group", "dob_from", "dob_to", "registered_from", "registered_to"]

