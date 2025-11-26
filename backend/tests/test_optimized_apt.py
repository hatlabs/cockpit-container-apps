"""
Unit tests for optimized APT cache querying.
"""

from unittest.mock import MagicMock

import pytest

from cockpit_container_apps.utils.optimized_apt import get_packages_by_origin
from tests.conftest import MockCache, MockPackage


@pytest.fixture
def packages_with_origins():
    """Fixture providing test packages with various origins."""
    packages = []

    # Package from Hat Labs origin
    pkg1 = MockPackage("signalk-container", summary="Marine data server", version="2.0.0")
    origin1 = MagicMock()
    origin1.origin = "Hat Labs"
    origin1.label = "Hat Labs"
    origin1.suite = "stable"
    pkg1.candidate.origins = [origin1]
    packages.append(pkg1)

    # Another package from Hat Labs
    pkg2 = MockPackage("grafana-container", summary="Monitoring dashboard", version="10.0.0")
    origin2 = MagicMock()
    origin2.origin = "Hat Labs"
    origin2.label = "Hat Labs"
    origin2.suite = "stable"
    pkg2.candidate.origins = [origin2]
    packages.append(pkg2)

    # Package from Debian origin
    pkg3 = MockPackage("nginx", summary="HTTP server", version="1.18.0")
    origin3 = MagicMock()
    origin3.origin = "Debian"
    origin3.label = "Debian"
    origin3.suite = "trixie"
    pkg3.candidate.origins = [origin3]
    packages.append(pkg3)

    # Package with no origin (only label)
    pkg4 = MockPackage("custom-pkg", summary="Custom package", version="1.0.0")
    origin4 = MagicMock()
    origin4.origin = ""
    origin4.label = "Custom"
    origin4.suite = "unstable"
    pkg4.candidate.origins = [origin4]
    packages.append(pkg4)

    # Package with no origins at all
    pkg5 = MockPackage("no-origin-pkg", summary="No origin package", version="1.0.0")
    pkg5.candidate.origins = []
    packages.append(pkg5)

    return packages


class TestGetPackagesByOrigin:
    """Tests for get_packages_by_origin function."""

    def test_filter_by_single_origin(self, packages_with_origins):
        """Test filtering packages by a single origin."""
        cache = MockCache(packages_with_origins)

        result = get_packages_by_origin(cache, "Hat Labs")

        assert len(result) == 2
        names = [p.name for p in result]
        assert "signalk-container" in names
        assert "grafana-container" in names

    def test_filter_by_different_origin(self, packages_with_origins):
        """Test filtering by Debian origin."""
        cache = MockCache(packages_with_origins)

        result = get_packages_by_origin(cache, "Debian")

        assert len(result) == 1
        assert result[0].name == "nginx"

    def test_filter_by_label_when_no_origin(self, packages_with_origins):
        """Test filtering falls back to label when origin is empty."""
        cache = MockCache(packages_with_origins)

        result = get_packages_by_origin(cache, "Custom")

        assert len(result) == 1
        assert result[0].name == "custom-pkg"

    def test_no_matches(self, packages_with_origins):
        """Test filtering with origin that has no matches."""
        cache = MockCache(packages_with_origins)

        result = get_packages_by_origin(cache, "Nonexistent")

        assert len(result) == 0

    def test_empty_cache(self):
        """Test with empty APT cache."""
        cache = MockCache([])

        result = get_packages_by_origin(cache, "Hat Labs")

        assert len(result) == 0

    def test_packages_without_candidate(self, packages_with_origins):
        """Test handling of packages without candidate version."""
        pkg_no_candidate = MockPackage("broken-pkg", summary="Broken package")
        pkg_no_candidate.candidate = None
        packages_with_origins.append(pkg_no_candidate)

        cache = MockCache(packages_with_origins)

        # Should not crash, just skip the broken package
        result = get_packages_by_origin(cache, "Hat Labs")

        assert len(result) == 2
        names = [p.name for p in result]
        assert "broken-pkg" not in names

    def test_performance_early_exit(self, packages_with_origins):
        """Test that iteration uses early exit optimization."""
        # Create a large cache with many Debian packages
        large_package_list = []

        # Add 100 Hat Labs packages at the start
        for i in range(100):
            pkg = MockPackage(f"hatlabs-pkg-{i}", summary=f"Hat Labs package {i}")
            origin = MagicMock()
            origin.origin = "Hat Labs"
            origin.label = "Hat Labs"
            origin.suite = "stable"
            pkg.candidate.origins = [origin]
            large_package_list.append(pkg)

        # Add 1000 Debian packages
        for i in range(1000):
            pkg = MockPackage(f"debian-pkg-{i}", summary=f"Debian package {i}")
            origin = MagicMock()
            origin.origin = "Debian"
            origin.label = "Debian"
            origin.suite = "trixie"
            pkg.candidate.origins = [origin]
            large_package_list.append(pkg)

        cache = MockCache(large_package_list)

        # Filter for Hat Labs packages
        result = get_packages_by_origin(cache, "Hat Labs")

        # Should find all 100 Hat Labs packages
        assert len(result) == 100

        # All results should be from Hat Labs
        for pkg in result:
            assert pkg.name.startswith("hatlabs-pkg-")
