"""Utility modules for cockpit-container-apps.

This package contains utility modules for store configuration and package filtering.
Store functionality was moved here from cockpit-apt as it's specific to container
app stores, not general APT functionality.
"""

from .store_config import (
    CategoryMetadata,
    StoreConfig,
    StoreFilter,
    load_stores,
)
from .store_filter import (
    count_matching_packages,
    filter_packages,
    matches_store_filter,
)

__all__ = [
    "CategoryMetadata",
    "StoreConfig",
    "StoreFilter",
    "load_stores",
    "count_matching_packages",
    "filter_packages",
    "matches_store_filter",
]
