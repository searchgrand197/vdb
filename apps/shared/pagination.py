from rest_framework.pagination import LimitOffsetPagination


class StandardLimitOffsetPagination(LimitOffsetPagination):
    """
    Market-friendly pagination with stable JSON shape.
    """

    default_limit = 20
    max_limit = 500


class LargeLimitOffsetPagination(LimitOffsetPagination):
    """For endpoints that must return large scoped lists (e.g. medicine categories per branch)."""

    default_limit = 500
    max_limit = 5000
