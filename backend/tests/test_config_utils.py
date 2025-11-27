"""Tests for config utilities."""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from cockpit_container_apps.utils.config_utils import (
    get_config_file_path,
    get_config_schema_path,
    get_env_defaults_path,
    parse_env_file,
    validate_config_value,
    write_env_file,
)


class TestPathConstructors:
    """Tests for config path construction functions."""

    def test_get_config_schema_path(self):
        """Test getting config schema path."""
        path = get_config_schema_path("signalk")
        assert path == Path("/var/lib/container-apps/signalk/config.yml")

    def test_get_env_defaults_path(self):
        """Test getting env defaults path."""
        path = get_env_defaults_path("signalk")
        assert path == Path("/etc/container-apps/signalk/env.defaults")

    def test_get_config_file_path(self):
        """Test getting user config file path."""
        path = get_config_file_path("signalk")
        assert path == Path("/etc/container-apps/signalk/env")

    def test_path_sanitization(self):
        """Test that package names are sanitized."""
        # Package names should only contain alphanumeric and dashes
        path = get_config_schema_path("signal-k")
        assert path == Path("/var/lib/container-apps/signal-k/config.yml")


class TestEnvFileParsing:
    """Tests for env file parsing."""

    def test_parse_empty_file(self):
        """Test parsing empty env file."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("")
            f.flush()
            result = parse_env_file(Path(f.name))

        assert result == {}
        Path(f.name).unlink()

    def test_parse_simple_values(self):
        """Test parsing simple key=value pairs."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("KEY1=value1\n")
            f.write("KEY2=value2\n")
            f.flush()
            result = parse_env_file(Path(f.name))

        assert result == {"KEY1": "value1", "KEY2": "value2"}
        Path(f.name).unlink()

    def test_parse_quoted_values(self):
        """Test parsing quoted values."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write('KEY1="value with spaces"\n')
            f.write("KEY2='single quoted'\n")
            f.flush()
            result = parse_env_file(Path(f.name))

        assert result == {"KEY1": "value with spaces", "KEY2": "single quoted"}
        Path(f.name).unlink()

    def test_parse_empty_values(self):
        """Test parsing empty values."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("KEY1=\n")
            f.write('KEY2=""\n')
            f.flush()
            result = parse_env_file(Path(f.name))

        assert result == {"KEY1": "", "KEY2": ""}
        Path(f.name).unlink()

    def test_parse_comments(self):
        """Test that comments are ignored."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("# This is a comment\n")
            f.write("KEY1=value1\n")
            f.write("  # Another comment\n")
            f.write("KEY2=value2  # inline comment\n")
            f.flush()
            result = parse_env_file(Path(f.name))

        # Note: inline comments should be part of the value unless we strip them
        assert "KEY1" in result
        assert result["KEY1"] == "value1"
        Path(f.name).unlink()

    def test_parse_blank_lines(self):
        """Test that blank lines are ignored."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("\n")
            f.write("KEY1=value1\n")
            f.write("\n\n")
            f.write("KEY2=value2\n")
            f.flush()
            result = parse_env_file(Path(f.name))

        assert result == {"KEY1": "value1", "KEY2": "value2"}
        Path(f.name).unlink()

    def test_parse_missing_file(self):
        """Test parsing non-existent file returns empty dict."""
        result = parse_env_file(Path("/nonexistent/file.env"))
        assert result == {}

    def test_parse_multiline_values(self):
        """Test parsing multiline values (should not be supported)."""
        # Env files typically don't support multiline values
        # Each line should be treated as separate
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            f.write("KEY1=line1\n")
            f.write("line2\n")  # This is invalid and should be ignored
            f.write("KEY2=value2\n")
            f.flush()
            result = parse_env_file(Path(f.name))

        # Invalid lines should be ignored
        assert "KEY1" in result
        assert "KEY2" in result
        Path(f.name).unlink()


class TestEnvFileWriting:
    """Tests for env file writing."""

    def test_write_simple_values(self):
        """Test writing simple key=value pairs."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            temp_path = Path(f.name)

        config = {"KEY1": "value1", "KEY2": "value2"}
        write_env_file(temp_path, config)

        content = temp_path.read_text()
        assert "KEY1=value1\n" in content
        assert "KEY2=value2\n" in content
        temp_path.unlink()

    def test_write_quoted_values(self):
        """Test that values with spaces are quoted."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            temp_path = Path(f.name)

        config = {"KEY1": "value with spaces", "KEY2": "simple"}
        write_env_file(temp_path, config)

        content = temp_path.read_text()
        assert 'KEY1="value with spaces"\n' in content or "KEY1='value with spaces'\n" in content
        assert "KEY2=simple\n" in content or 'KEY2="simple"\n' in content
        temp_path.unlink()

    def test_write_empty_values(self):
        """Test writing empty values."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            temp_path = Path(f.name)

        config = {"KEY1": "", "KEY2": "value2"}
        write_env_file(temp_path, config)

        content = temp_path.read_text()
        assert "KEY1=" in content
        assert "KEY2=value2\n" in content
        temp_path.unlink()

    def test_write_empty_config(self):
        """Test writing empty config."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            temp_path = Path(f.name)

        config = {}
        write_env_file(temp_path, config)

        content = temp_path.read_text()
        assert content == ""
        temp_path.unlink()

    def test_atomic_write(self):
        """Test that writes are atomic (temp file + rename)."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env") as f:
            temp_path = Path(f.name)

        # Write initial content
        temp_path.write_text("KEY1=old\n")

        # Write new content
        config = {"KEY1": "new", "KEY2": "value2"}

        # Mock to verify temp file strategy
        with patch("cockpit_container_apps.utils.config_utils.Path.rename") as mock_rename:
            write_env_file(temp_path, config)
            # Verify rename was called (atomic write pattern)
            mock_rename.assert_called_once()

        temp_path.unlink(missing_ok=True)

    def test_write_creates_parent_directories(self):
        """Test that parent directories are created if needed."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "subdir" / "config" / "env"

            config = {"KEY1": "value1"}
            write_env_file(config_path, config)

            assert config_path.exists()
            content = config_path.read_text()
            assert "KEY1=value1\n" in content


class TestConfigValidation:
    """Tests for config value validation."""

    def test_validate_string_field(self):
        """Test validating string fields."""
        field = {
            "id": "port",
            "type": "string",
            "label": "Port",
            "required": True,
        }

        # Valid
        assert validate_config_value(field, "3000") is True
        assert validate_config_value(field, "") is False  # Required but empty

        # Optional field
        field["required"] = False
        assert validate_config_value(field, "") is True

    def test_validate_integer_field(self):
        """Test validating integer fields."""
        field = {
            "id": "port",
            "type": "integer",
            "label": "Port",
            "min": 1,
            "max": 65535,
        }

        # Valid
        assert validate_config_value(field, "3000") is True
        assert validate_config_value(field, "1") is True
        assert validate_config_value(field, "65535") is True

        # Invalid
        assert validate_config_value(field, "0") is False  # Below min
        assert validate_config_value(field, "65536") is False  # Above max
        assert validate_config_value(field, "abc") is False  # Not a number
        assert validate_config_value(field, "3.14") is False  # Float, not int

    def test_validate_boolean_field(self):
        """Test validating boolean fields."""
        field = {
            "id": "enabled",
            "type": "boolean",
            "label": "Enabled",
        }

        # Valid - various boolean representations
        assert validate_config_value(field, "true") is True
        assert validate_config_value(field, "false") is True
        assert validate_config_value(field, "1") is True
        assert validate_config_value(field, "0") is True
        assert validate_config_value(field, "yes") is True
        assert validate_config_value(field, "no") is True

        # Invalid
        assert validate_config_value(field, "maybe") is False
        assert validate_config_value(field, "2") is False

    def test_validate_enum_field(self):
        """Test validating enum fields."""
        field = {
            "id": "log_level",
            "type": "enum",
            "label": "Log Level",
            "options": ["debug", "info", "warn", "error"],
        }

        # Valid
        assert validate_config_value(field, "debug") is True
        assert validate_config_value(field, "info") is True

        # Invalid
        assert validate_config_value(field, "trace") is False
        assert validate_config_value(field, "DEBUG") is False  # Case sensitive

    def test_validate_password_field(self):
        """Test validating password fields."""
        field = {
            "id": "password",
            "type": "password",
            "label": "Password",
            "required": True,
        }

        # Valid - any non-empty string
        assert validate_config_value(field, "secret123") is True
        assert validate_config_value(field, "p@ssw0rd!") is True

        # Invalid - empty when required
        assert validate_config_value(field, "") is False

        # Optional
        field["required"] = False
        assert validate_config_value(field, "") is True

    def test_validate_path_field(self):
        """Test validating path fields."""
        field = {
            "id": "data_dir",
            "type": "path",
            "label": "Data Directory",
        }

        # Valid - absolute paths
        assert validate_config_value(field, "/var/lib/data") is True
        assert validate_config_value(field, "/home/user/data") is True

        # Note: We might want to validate that paths are absolute
        # For now, just check it's a non-empty string
        assert validate_config_value(field, "relative/path") is True
        assert validate_config_value(field, "") is False

    def test_validate_unknown_field_type(self):
        """Test that unknown field types raise an error."""
        field = {
            "id": "custom",
            "type": "custom_type",
            "label": "Custom",
        }

        with pytest.raises(ValueError, match="Unknown field type"):
            validate_config_value(field, "value")

    def test_validate_missing_required_field_attributes(self):
        """Test validation with missing field attributes."""
        # Missing 'type' attribute
        field = {
            "id": "field",
            "label": "Field",
        }

        with pytest.raises(KeyError):
            validate_config_value(field, "value")
