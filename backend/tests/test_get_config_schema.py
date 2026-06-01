"""Tests for get_config_schema command."""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from cockpit_container_apps.commands import get_config_schema


class TestGetConfigSchema:
    """Tests for get-config-schema command."""

    def test_get_schema_simple(self):
        """Test getting a simple config schema."""
        # Create a temp schema file
        schema_content = """version: "1.0"
groups:
  - id: general
    label: General Settings
    description: Basic configuration options
    fields:
      - id: PORT
        type: integer
        label: Port
        description: Server port
        default: "3000"
        min: 1
        max: 65535
        required: true
"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".yml") as f:
            f.write(schema_content)
            f.flush()
            schema_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config_schema.get_config_schema_path",
            return_value=schema_path,
        ):
            result = get_config_schema.execute(package="signalk")

        schema_path.unlink()

        # Verify structure
        assert result["success"] is True
        assert "schema" in result
        assert result["schema"]["version"] == "1.0"
        assert len(result["schema"]["groups"]) == 1
        assert result["schema"]["groups"][0]["id"] == "general"
        assert len(result["schema"]["groups"][0]["fields"]) == 1
        assert result["schema"]["groups"][0]["fields"][0]["id"] == "PORT"

    def test_get_schema_multiple_groups(self):
        """Test getting schema with multiple groups."""
        schema_content = """version: "1.0"
groups:
  - id: general
    label: General Settings
    fields:
      - id: PORT
        type: integer
        label: Port
        default: "3000"
  - id: security
    label: Security Settings
    fields:
      - id: ADMIN_PASSWORD
        type: password
        label: Admin Password
        required: true
"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".yml") as f:
            f.write(schema_content)
            f.flush()
            schema_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config_schema.get_config_schema_path",
            return_value=schema_path,
        ):
            result = get_config_schema.execute(package="signalk")

        schema_path.unlink()

        assert result["success"] is True
        assert len(result["schema"]["groups"]) == 2
        assert result["schema"]["groups"][0]["id"] == "general"
        assert result["schema"]["groups"][1]["id"] == "security"

    def test_get_schema_all_field_types(self):
        """Test schema with all supported field types."""
        schema_content = """version: "1.0"
groups:
  - id: test
    label: Test Fields
    fields:
      - id: STRING_FIELD
        type: string
        label: String Field
      - id: INT_FIELD
        type: integer
        label: Integer Field
        min: 0
        max: 100
      - id: BOOL_FIELD
        type: boolean
        label: Boolean Field
      - id: ENUM_FIELD
        type: enum
        label: Enum Field
        options:
          - value: opt1
            label: Option 1
          - value: opt2
            label: Option 2
      - id: PASSWORD_FIELD
        type: password
        label: Password Field
      - id: PATH_FIELD
        type: path
        label: Path Field
"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".yml") as f:
            f.write(schema_content)
            f.flush()
            schema_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config_schema.get_config_schema_path",
            return_value=schema_path,
        ):
            result = get_config_schema.execute(package="test-package")

        schema_path.unlink()

        assert result["success"] is True
        fields = result["schema"]["groups"][0]["fields"]
        assert len(fields) == 6
        assert fields[0]["type"] == "string"
        assert fields[1]["type"] == "integer"
        assert fields[2]["type"] == "boolean"
        assert fields[3]["type"] == "enum"
        assert fields[4]["type"] == "password"
        assert fields[5]["type"] == "path"

    def test_get_schema_missing_file(self):
        """Test getting schema when file doesn't exist."""
        with patch(
            "cockpit_container_apps.commands.get_config_schema.get_config_schema_path",
            return_value=Path("/nonexistent/config.yml"),
        ):
            result = get_config_schema.execute(package="nonexistent")

        assert result["success"] is False
        assert "error" in result
        assert "not found" in result["error"].lower() or "does not exist" in result["error"].lower()

    def test_get_schema_invalid_yaml(self):
        """Test getting schema with invalid YAML."""
        schema_content = """version: "1.0"
groups:
  - id: general
    label: General Settings
    fields: [invalid yaml structure
"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".yml") as f:
            f.write(schema_content)
            f.flush()
            schema_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config_schema.get_config_schema_path",
            return_value=schema_path,
        ):
            result = get_config_schema.execute(package="signalk")

        schema_path.unlink()

        assert result["success"] is False
        assert "error" in result
        assert "yaml" in result["error"].lower() or "parse" in result["error"].lower()

    def test_get_schema_missing_version(self):
        """Test getting schema without version field."""
        schema_content = """groups:
  - id: general
    label: General Settings
    fields:
      - id: PORT
        type: integer
        label: Port
"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".yml") as f:
            f.write(schema_content)
            f.flush()
            schema_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config_schema.get_config_schema_path",
            return_value=schema_path,
        ):
            result = get_config_schema.execute(package="signalk")

        schema_path.unlink()

        assert result["success"] is False
        assert "error" in result
        assert "version" in result["error"].lower()

    def test_get_schema_missing_groups(self):
        """Test getting schema without groups field."""
        schema_content = """version: "1.0"
"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".yml") as f:
            f.write(schema_content)
            f.flush()
            schema_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config_schema.get_config_schema_path",
            return_value=schema_path,
        ):
            result = get_config_schema.execute(package="signalk")

        schema_path.unlink()

        assert result["success"] is False
        assert "error" in result
        assert "groups" in result["error"].lower()

    def test_get_schema_empty_package_name(self):
        """Test getting schema with empty package name."""
        with pytest.raises(ValueError, match="package name"):
            get_config_schema.execute(package="")

    def test_get_schema_invalid_package_name(self):
        """Test getting schema with invalid package name."""
        # Package names with invalid characters
        with pytest.raises(ValueError, match="package name"):
            get_config_schema.execute(package="../../etc/passwd")

    def test_get_schema_preserves_all_attributes(self):
        """Test that all schema attributes are preserved."""
        schema_content = """version: "1.0"
groups:
  - id: general
    label: General Settings
    description: This is a description
    fields:
      - id: PORT
        type: integer
        label: Port Number
        description: The port to bind to
        default: "3000"
        min: 1
        max: 65535
        required: true
        help: "Enter a port between 1 and 65535"
"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".yml") as f:
            f.write(schema_content)
            f.flush()
            schema_path = Path(f.name)

        with patch(
            "cockpit_container_apps.commands.get_config_schema.get_config_schema_path",
            return_value=schema_path,
        ):
            result = get_config_schema.execute(package="signalk")

        schema_path.unlink()

        assert result["success"] is True
        group = result["schema"]["groups"][0]
        assert group["description"] == "This is a description"

        field = group["fields"][0]
        assert field["description"] == "The port to bind to"
        assert field["default"] == "3000"
        assert field["min"] == 1
        assert field["max"] == 65535
        assert field["required"] is True
        assert field["help"] == "Enter a port between 1 and 65535"
