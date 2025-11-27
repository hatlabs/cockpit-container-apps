"""Tests for get_config command."""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from cockpit_container_apps.commands import get_config


class TestGetConfig:
    """Tests for get-config command."""

    def test_get_config_defaults_only(self):
        """Test getting config when only defaults exist."""
        # Create env.defaults
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".defaults") as f:
            f.write("PORT=3000\n")
            f.write("HOST=localhost\n")
            defaults_path = Path(f.name)

        # No user config file
        config_path = Path("/nonexistent/env")

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        defaults_path.unlink()

        assert result["success"] is True
        assert "config" in result
        assert result["config"]["PORT"] == "3000"
        assert result["config"]["HOST"] == "localhost"

    def test_get_config_with_overrides(self):
        """Test getting config with user overrides."""
        # Create env.defaults
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".defaults") as f:
            f.write("PORT=3000\n")
            f.write("HOST=localhost\n")
            f.write("DEBUG=false\n")
            defaults_path = Path(f.name)

        # Create user config with overrides
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("PORT=8080\n")  # Override
            f.write("DEBUG=true\n")  # Override
            config_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        defaults_path.unlink()
        config_path.unlink()

        assert result["success"] is True
        assert result["config"]["PORT"] == "8080"  # Overridden
        assert result["config"]["HOST"] == "localhost"  # From defaults
        assert result["config"]["DEBUG"] == "true"  # Overridden

    def test_get_config_user_only(self):
        """Test getting config when only user config exists (no defaults)."""
        # No defaults file
        defaults_path = Path("/nonexistent/env.defaults")

        # Create user config
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("PORT=8080\n")
            f.write("DEBUG=true\n")
            config_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        config_path.unlink()

        assert result["success"] is True
        assert result["config"]["PORT"] == "8080"
        assert result["config"]["DEBUG"] == "true"

    def test_get_config_no_files(self):
        """Test getting config when neither file exists."""
        defaults_path = Path("/nonexistent/env.defaults")
        config_path = Path("/nonexistent/env")

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        # Should return empty config (not an error)
        assert result["success"] is True
        assert result["config"] == {}

    def test_get_config_empty_files(self):
        """Test getting config from empty files."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".defaults") as f:
            f.write("")
            defaults_path = Path(f.name)

        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("")
            config_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        defaults_path.unlink()
        config_path.unlink()

        assert result["success"] is True
        assert result["config"] == {}

    def test_get_config_with_comments(self):
        """Test that comments are ignored."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".defaults") as f:
            f.write("# Default configuration\n")
            f.write("PORT=3000\n")
            f.write("# HOST setting\n")
            f.write("HOST=localhost\n")
            defaults_path = Path(f.name)

        config_path = Path("/nonexistent/env")

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        defaults_path.unlink()

        assert result["success"] is True
        assert result["config"]["PORT"] == "3000"
        assert result["config"]["HOST"] == "localhost"
        assert "# Default configuration" not in result["config"]

    def test_get_config_with_empty_values(self):
        """Test getting config with empty values."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".defaults") as f:
            f.write("PORT=3000\n")
            f.write("OPTIONAL_SETTING=\n")
            defaults_path = Path(f.name)

        config_path = Path("/nonexistent/env")

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        defaults_path.unlink()

        assert result["success"] is True
        assert result["config"]["PORT"] == "3000"
        assert result["config"]["OPTIONAL_SETTING"] == ""

    def test_get_config_malformed_file(self):
        """Test getting config with malformed env file."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".defaults") as f:
            f.write("PORT=3000\n")
            f.write("INVALID LINE WITHOUT EQUALS\n")
            f.write("HOST=localhost\n")
            defaults_path = Path(f.name)

        config_path = Path("/nonexistent/env")

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        defaults_path.unlink()

        # Should skip malformed lines and continue
        assert result["success"] is True
        assert result["config"]["PORT"] == "3000"
        assert result["config"]["HOST"] == "localhost"

    def test_get_config_empty_package_name(self):
        """Test getting config with empty package name."""
        with pytest.raises(ValueError, match="package name"):
            get_config.execute(package="")

    def test_get_config_invalid_package_name(self):
        """Test getting config with invalid package name."""
        with pytest.raises(ValueError, match="package name"):
            get_config.execute(package="../../etc/passwd")

    def test_get_config_read_error(self):
        """Test getting config when file read fails."""
        import os

        # Skip this test if running as root (Docker containers)
        # Root can read files regardless of permissions
        if os.geteuid() == 0:
            pytest.skip("Test requires non-root user (file permissions don't apply to root)")

        # Create a file with restricted permissions
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".defaults") as f:
            f.write("PORT=3000\n")
            defaults_path = Path(f.name)

        # Make file unreadable (on Unix systems)
        defaults_path.chmod(0o000)

        config_path = Path("/nonexistent/env")

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        # Restore permissions and cleanup
        defaults_path.chmod(0o644)
        defaults_path.unlink()

        # Should return an error
        assert result["success"] is False
        assert "error" in result

    def test_get_config_merging_order(self):
        """Test that user config correctly overrides defaults."""
        # Create env.defaults
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".defaults") as f:
            f.write("A=default_a\n")
            f.write("B=default_b\n")
            f.write("C=default_c\n")
            defaults_path = Path(f.name)

        # Create user config - only override B
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("B=user_b\n")
            config_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        defaults_path.unlink()
        config_path.unlink()

        assert result["success"] is True
        assert result["config"]["A"] == "default_a"  # From defaults
        assert result["config"]["B"] == "user_b"  # Overridden
        assert result["config"]["C"] == "default_c"  # From defaults

    def test_get_config_user_adds_new_keys(self):
        """Test that user config can add keys not in defaults."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".defaults") as f:
            f.write("PORT=3000\n")
            defaults_path = Path(f.name)

        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("PORT=8080\n")
            f.write("NEW_KEY=new_value\n")  # Not in defaults
            config_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config.get_env_defaults_path",
            return_value=defaults_path,
        ), patch(
            "cockpit_container_apps.commands.get_config.get_config_file_path",
            return_value=config_path,
        ):
            result = get_config.execute(package="signalk")

        defaults_path.unlink()
        config_path.unlink()

        assert result["success"] is True
        assert result["config"]["PORT"] == "8080"
        assert result["config"]["NEW_KEY"] == "new_value"
