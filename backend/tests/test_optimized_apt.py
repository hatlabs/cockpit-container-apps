"""
Integration tests for optimized APT cache querying with real APT data.

These tests use the actual Debian packages in the Docker container
to test the apt_pkg optimization against real data.
"""

import pytest

from cockpit_container_apps.utils.optimized_apt import (
    get_packages_by_origin,
    get_packages_by_origins,
)


class TestGetPackagesByOriginIntegration:
    """Integration tests for get_packages_by_origin with real APT cache."""

    def test_filter_by_debian_origin(self, real_apt_cache, debian_packages):
        """Test filtering packages by Debian origin."""
        if not debian_packages:
            pytest.skip("No Debian packages available for testing")

        # Get the origin name from one of the packages
        origin = list(debian_packages.values())[0]

        result = get_packages_by_origin(real_apt_cache, origin)

        # Should return packages (at least the ones we found)
        assert len(result) > 0
        assert all(pkg.name for pkg in result)

        # Verify all returned packages have the correct origin
        for pkg in result:
            if pkg.candidate and pkg.candidate.origins:
                pkg_origin = pkg.candidate.origins[0].origin
                assert pkg_origin == origin

    def test_filter_by_nonexistent_origin(self, real_apt_cache):
        """Test filtering with origin that has no matches."""
        result = get_packages_by_origin(real_apt_cache, "Nonexistent Origin XYZ")

        assert len(result) == 0

    def test_returns_package_objects(self, real_apt_cache, debian_packages):
        """Test that returned packages have expected properties."""
        if not debian_packages:
            pytest.skip("No Debian packages available for testing")

        origin = list(debian_packages.values())[0]
        result = get_packages_by_origin(real_apt_cache, origin)

        assert len(result) > 0

        # Check first package has expected properties
        pkg = result[0]
        assert hasattr(pkg, "name")
        assert hasattr(pkg, "candidate")
        assert hasattr(pkg, "is_installed")


class TestGetPackagesByOriginsIntegration:
    """Integration tests for get_packages_by_origins with real APT cache."""

    def test_filter_by_multiple_origins(self, real_apt_cache, debian_packages):
        """Test filtering by multiple origins."""
        if not debian_packages:
            pytest.skip("No Debian packages available for testing")

        # Get unique origins from test packages
        origins = list(set(debian_packages.values()))

        result = get_packages_by_origins(real_apt_cache, origins)

        # Should return packages from any of the specified origins
        assert len(result) > 0

    def test_empty_origins_list(self, real_apt_cache):
        """Test that empty origins list returns empty result."""
        result = get_packages_by_origins(real_apt_cache, [])

        assert len(result) == 0

    def test_performance_benefit(self, real_apt_cache, debian_packages):
        """Test that optimization provides results efficiently."""
        if not debian_packages:
            pytest.skip("No Debian packages available for testing")

        origin = list(debian_packages.values())[0]

        # Just verify it completes and returns results
        # The actual performance benefit is visible in production with 50k+ packages
        result = get_packages_by_origin(real_apt_cache, origin)

        assert len(result) > 0
        assert all(isinstance(pkg.name, str) for pkg in result)
