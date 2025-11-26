"""
Unit tests for optimized store filter pre-filtering.
"""

from unittest.mock import MagicMock

import pytest

from cockpit_container_apps.utils.store_config import StoreConfig, StoreFilter
from cockpit_container_apps.utils.store_filter import get_pre_filtered_packages
from tests.conftest import MockCache, MockPackage


@pytest.fixture
def mixed_origin_packages():
    """Fixture with packages from different origins."""
    packages = []

    # Hat Labs marine packages
    for i in range(20):
        pkg = MockPackage(f"marine-app-{i}", summary=f"Marine app {i}")
        origin = MagicMock()
        origin.origin = "Hat Labs"
        origin.label = "Hat Labs"
        origin.suite = "stable"
        pkg.candidate.origins = [origin]
        pkg.candidate.record["Tag"] = "role::container-app, field::marine"
        packages.append(pkg)

    # Debian packages (50,000+ in reality, using 100 for test)
    for i in range(100):
        pkg = MockPackage(f"debian-pkg-{i}", summary=f"Debian package {i}")
        origin = MagicMock()
        origin.origin = "Debian"
        origin.label = "Debian"
        origin.suite = "trixie"
        pkg.candidate.origins = [origin]
        pkg.candidate.record["Tag"] = "role::application"
        packages.append(pkg)

    return packages


@pytest.fixture
def marine_store_config():
    """Fixture for marine store configuration with origin filter."""
    return StoreConfig(
        id="marine",
        name="Marine Apps",
        description="Marine navigation and monitoring apps",
        filters=StoreFilter(
            include_origins=["Hat Labs"],
            include_sections=[],
            include_tags=["role::container-app"],
            include_packages=[],
        ),
    )


@pytest.fixture
def debian_store_config():
    """Fixture for store without origin filter."""
    return StoreConfig(
        id="debian",
        name="Debian Apps",
        description="General Debian packages",
        filters=StoreFilter(
            include_origins=[],
            include_sections=[],
            include_tags=["role::application"],
            include_packages=[],
        ),
    )


class TestGetPreFilteredPackages:
    """Tests for get_pre_filtered_packages function."""

    def test_pre_filter_with_origin(self, mixed_origin_packages, marine_store_config):
        """Test pre-filtering with origin reduces package set."""
        cache = MockCache(mixed_origin_packages)

        result = get_pre_filtered_packages(cache, marine_store_config)

        # Should only return Hat Labs packages (20 out of 120)
        assert len(result) == 20
        for pkg in result:
            assert pkg.name.startswith("marine-app-")

    def test_pre_filter_without_origin_falls_back(self, mixed_origin_packages, debian_store_config):
        """Test that stores without origin filter use full cache."""
        cache = MockCache(mixed_origin_packages)

        result = get_pre_filtered_packages(cache, debian_store_config)

        # Should return all packages since no origin pre-filtering
        # Note: This returns the full cache for further filtering
        assert len(result) == 120

    def test_pre_filter_empty_cache(self, marine_store_config):
        """Test pre-filtering with empty cache."""
        cache = MockCache([])

        result = get_pre_filtered_packages(cache, marine_store_config)

        assert len(result) == 0

    def test_pre_filter_multiple_origins(self, mixed_origin_packages):
        """Test pre-filtering with multiple origins."""
        # Add packages from another origin
        ubuntu_pkg = MockPackage("ubuntu-pkg", summary="Ubuntu package")
        origin = MagicMock()
        origin.origin = "Ubuntu"
        origin.label = "Ubuntu"
        origin.suite = "noble"
        ubuntu_pkg.candidate.origins = [origin]
        mixed_origin_packages.append(ubuntu_pkg)

        cache = MockCache(mixed_origin_packages)

        # Store that accepts both Hat Labs and Ubuntu
        multi_origin_store = StoreConfig(
            id="multi",
            name="Multi Origin",
            description="Multiple origins",
            filters=StoreFilter(
                include_origins=["Hat Labs", "Ubuntu"],
                include_sections=[],
                include_tags=["role::container-app"],  # Need at least one tag to satisfy filter validation
                include_packages=[],
            ),
        )

        result = get_pre_filtered_packages(cache, multi_origin_store)

        # Should return Hat Labs (20) + Ubuntu (1) = 21
        assert len(result) == 21
        names = [p.name for p in result]
        assert "ubuntu-pkg" in names

    def test_performance_benefit(self, mixed_origin_packages, marine_store_config):
        """Test that pre-filtering provides significant performance benefit."""
        cache = MockCache(mixed_origin_packages)

        # Without optimization, would iterate all 120 packages
        # With optimization, only returns 20 packages
        result = get_pre_filtered_packages(cache, marine_store_config)

        # Verify we got massive reduction
        total_packages = len(mixed_origin_packages)
        filtered_packages = len(result)

        assert filtered_packages < total_packages
        assert filtered_packages == 20  # Only Hat Labs packages
        reduction_ratio = total_packages / filtered_packages
        assert reduction_ratio == 6  # 120/20 = 6x reduction in this test

    def test_store_with_no_origin_filter(self):
        """Test store without origin filter (uses tags instead)."""
        packages = [
            MockPackage("pkg1", summary="Package 1"),
            MockPackage("pkg2", summary="Package 2"),
        ]
        for pkg in packages:
            pkg.candidate.record["Tag"] = "role::application"

        cache = MockCache(packages)

        tag_store = StoreConfig(
            id="tag-store",
            name="Tag Store",
            description="Tag-based filtering",
            filters=StoreFilter(
                include_origins=[],
                include_sections=[],
                include_tags=["role::application"],
                include_packages=[],
            ),
        )

        result = get_pre_filtered_packages(cache, tag_store)

        # With no origin filter, should return full cache
        assert len(result) == 2
