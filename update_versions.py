import json
import os
import re
from datetime import datetime

LATEST_VERSION = "1.9.3"
RELEASE_DATE = datetime.now().strftime("%Y-%-m-%d")  # Format: YYYY-M-D

WORKING_DIR = os.path.join(
    os.path.dirname(os.path.realpath(__file__)), "materialious"
)

ROOT_PACKAGE = os.path.join(WORKING_DIR, "package.json")
ELECTRON_PACKAGE = os.path.join(WORKING_DIR, "electron", "package.json")
ANDROID_PACKAGE = os.path.join(WORKING_DIR, "android", "app", "build.gradle")
METAINFO_FILE = os.path.join(
    WORKING_DIR, "electron", "materialious.metainfo.xml"
)


def package_json_update_ver(location: str) -> None:
    with open(location, "r") as f_:
        package = json.load(f_)
        if package["version"] == LATEST_VERSION:
            return
        package["version"] = LATEST_VERSION

    with open(location, "w") as f_:
        json.dump(package, f_, indent="\t")


def update_android_version() -> None:
    with open(ANDROID_PACKAGE, "r") as f_:
        contents = f_.read()

    version_code_match = re.search(r"versionCode\s+(\d+)", contents)
    version_name_match = re.search(r'versionName\s+"([^"]+)"', contents)

    if version_code_match and version_name_match:
        version_code = int(version_code_match.group(1)) + 1
        contents = re.sub(
            r"versionCode\s+\d+", f"versionCode {version_code}", contents
        )
        contents = re.sub(
            r'versionName\s+"[^"]+"',
            f'versionName "{LATEST_VERSION}"',
            contents,
        )

        with open(ANDROID_PACKAGE, "w") as f_:
            f_.write(contents)


def update_metainfo_release() -> None:
    with open(METAINFO_FILE, "r") as f_:
        contents = f_.read()

    # Check if the version already exists in the releases
    if re.search(rf'<release version="{re.escape(LATEST_VERSION)}"', contents):
        print(f"Release version {LATEST_VERSION} already exists.")
        return

    new_release = f"""
    <release version="{LATEST_VERSION}" date="{RELEASE_DATE}">
      <url>https://github.com/Materialious/Materialious/releases/tag/{LATEST_VERSION}</url>
    </release>"""

    # Insert the new release after the opening <releases> tag
    updated_contents = re.sub(
        r"(<releases>\s*)", rf"\1{new_release}\n", contents
    )

    with open(METAINFO_FILE, "w") as f_:
        f_.write(updated_contents)


if __name__ == "__main__":
    for location in (ROOT_PACKAGE, ELECTRON_PACKAGE):
        package_json_update_ver(location)

    update_android_version()
    update_metainfo_release()
