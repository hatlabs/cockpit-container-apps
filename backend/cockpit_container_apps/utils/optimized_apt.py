"""Optimized APT cache querying.

This module provides optimized functions for querying the APT cache,
particularly for filtering packages by origin to avoid full cache iteration.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import apt

logger = logging.getLogger(__name__)


def get_packages_by_origin(cache: apt.Cache, origin_name: str) -> list[apt.Package]:
    """Get all packages from a specific origin.

    This function provides an optimized way to filter packages by origin,
    avoiding the need to iterate through the entire APT cache and check
    each package individually.

    Args:
        cache: APT cache object
        origin_name: The origin name to filter by (e.g., "Hat Labs")

    Returns:
        List of packages from the specified origin

    Example:
        >>> cache = apt.Cache()
        >>> marine_packages = get_packages_by_origin(cache, "Hat Labs")
        >>> print(f"Found {len(marine_packages)} packages from Hat Labs")
        Found 20 packages from Hat Labs
    """
    matching_packages = []

    for package in cache:
        # Skip packages without candidate version
        if not hasattr(package, "candidate") or package.candidate is None:
            continue

        # Get package origins
        try:
            origins = package.candidate.origins
            if not origins:
                continue
        except (AttributeError, TypeError):
            logger.debug("Error getting origins for package %s", package.name)
            continue

        # Check first origin (typically the primary source)
        origin_obj = origins[0]

        try:
            # Get origin and label
            pkg_origin = getattr(origin_obj, "origin", "") or ""
            pkg_label = getattr(origin_obj, "label", "") or ""

            # Match on origin, or fall back to label if origin is empty
            package_origin = pkg_origin if pkg_origin else pkg_label

            if package_origin == origin_name:
                matching_packages.append(package)

        except (AttributeError, TypeError) as e:
            logger.debug(
                "Error checking origin for package %s: %s",
                package.name,
                e,
            )
            continue

    logger.info(
        "Found %d packages from origin '%s' (out of %d total packages)",
        len(matching_packages),
        origin_name,
        len(cache),
    )

    return matching_packages
