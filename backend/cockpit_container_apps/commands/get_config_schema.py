"""
Get config schema command implementation.

Returns the configuration schema for a package.
"""

import logging
from typing import Any

import yaml

from cockpit_container_apps.utils.config_utils import (
    _validate_package_name,
    get_config_schema_path,
)

logger = logging.getLogger(__name__)


def execute(package: str) -> dict[str, Any]:
    """
    Get configuration schema for a package.

    Args:
        package: Package name

    Returns:
        Dictionary with:
        - success: Boolean indicating success
        - schema: Schema dict (if successful) with version and groups
        - error: Error message (if failed)
    """
    try:
        # Validate package name
        _validate_package_name(package)

        # Get schema file path
        schema_path = get_config_schema_path(package)

        # Check if file exists
        if not schema_path.exists():
            return {
                "success": False,
                "error": f"Config schema not found for package '{package}' at {schema_path}",
            }

        # Read and parse YAML
        try:
            with schema_path.open("r") as f:
                schema = yaml.safe_load(f)
        except yaml.YAMLError as e:
            return {
                "success": False,
                "error": f"Failed to parse YAML schema: {e}",
            }
        except (OSError, PermissionError) as e:
            return {
                "success": False,
                "error": f"Failed to read schema file: {e}",
            }

        # Validate schema structure
        if not isinstance(schema, dict):
            return {
                "success": False,
                "error": "Invalid schema: root must be a dictionary",
            }

        if "version" not in schema:
            return {
                "success": False,
                "error": "Invalid schema: missing 'version' field",
            }

        if "groups" not in schema:
            return {
                "success": False,
                "error": "Invalid schema: missing 'groups' field",
            }

        # Return the schema
        return {
            "success": True,
            "schema": schema,
        }

    except ValueError as e:
        # Package name validation error
        logger.error(f"Validation error: {e}")
        raise

    except Exception as e:
        # Unexpected error
        logger.error(f"Unexpected error getting config schema: {e}")
        return {
            "success": False,
            "error": f"Unexpected error: {e}",
        }
