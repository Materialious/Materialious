"""Small script for keeping versioning consistent for Materialious
"""

import json
import os
import re

LATEST_VERSION = "1.6.21"
WORKING_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "materialious")

ROOT_PACKAGE = os.path.join(WORKING_DIR, "package.json")
ELECTRON_PACKAGE = os.path.join(WORKING_DIR, "electron", "package.json")
ANDROID_PACKAGE = os.path.join(WORKING_DIR, "android", "app", "build.gradle")


def package_json_update_ver(location: str) -> None:
    with open(location, "r") as f_:
        package = json.loads(f_.read())
        if package["version"] == LATEST_VERSION:
            return

        package["version"] = LATEST_VERSION

    with open(location, "w") as f_:
        f_.write(json.dumps(package, indent="\t"))


if __name__ == "__main__":
    for location in (ROOT_PACKAGE, ELECTRON_PACKAGE):
        package_json_update_ver(location)

    with open(ANDROID_PACKAGE, "r") as f_:
        contents = f_.read()

        version_code_match = re.search(r"versionCode\s+(\d+)", contents)
        version_name_match = re.search(r'versionName\s+"([^"]+)"', contents)

        if version_code_match and version_name_match:
            version_code = version_code_match.group(1)
            version_name = version_name_match.group(1)

            f_.close()

            with open(ANDROID_PACKAGE, "w") as f_:
                new_version_code = int(version_code) + 1

                f_.write(
                    contents.replace(
                        f"versionCode {version_code}", f"versionCode {new_version_code}"
                    ).replace(
                        f'versionName "{version_name}"',
                        f'versionName "{LATEST_VERSION}"',
                    )
                )
