"""
Get config command implementation.

Returns the current configuration for a package (merged defaults + overrides).
"""

import logging
from typing import Any

from cockpit_container_apps.utils.config_utils import (
    _validate_package_name,
    get_config_file_path,
    get_env_defaults_path,
    parse_env_file,
)

logger = logging.getLogger(__name__)


def execute(package: str) -> dict[str, Any]:
    """
    Get current configuration for a package.

    Merges env.defaults (package defaults) with env (user overrides).
    User config takes precedence over defaults.

    Args:
        package: Package name

    Returns:
        Dictionary with:
        - success: Boolean indicating success
        - config: Merged config dict (if successful)
        - error: Error message (if failed)
    """
    try:
        # Validate package name
        _validate_package_name(package)

        # Get file paths
        defaults_path = get_env_defaults_path(package)
        config_path = get_config_file_path(package)

        # Parse defaults file (if exists)
        try:
            defaults = parse_env_file(defaults_path)
        except (OSError, PermissionError) as e:
            return {
                "success": False,
                "error": f"Failed to read defaults file: {e}",
            }

        # Parse user config file (if exists)
        try:
            user_config = parse_env_file(config_path)
        except (OSError, PermissionError) as e:
            return {
                "success": False,
                "error": f"Failed to read config file: {e}",
            }

        # Merge: user config overrides defaults
        merged_config = {**defaults, **user_config}

        return {
            "success": True,
            "config": merged_config,
        }

    except ValueError as e:
        # Package name validation error
        logger.error(f"Validation error: {e}")
        raise

    except Exception as e:
        # Unexpected error
        logger.error(f"Unexpected error getting config: {e}")
        return {
            "success": False,
            "error": f"Unexpected error: {e}",
        }
