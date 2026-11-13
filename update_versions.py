import json
import os
import re
from datetime import datetime

import requests

LATEST_VERSION = "1.18.26"
RELEASE_DATE = datetime.now().strftime("%Y-%-m-%d")  # Format: YYYY-M-D

WORKING_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "materialious")

ROOT_PACKAGE = os.path.join(WORKING_DIR, "package.json")
SHARED_PACKAGE = os.path.join(WORKING_DIR, "shared", "package.json")
ELECTRON_PACKAGE = os.path.join(WORKING_DIR, "electron", "package.json")
ANDROID_PACKAGE = os.path.join(WORKING_DIR, "android", "app", "build.gradle")
METAINFO_FILE = os.path.join(WORKING_DIR, "electron", "materialious.metainfo.xml")
CONTRIBUTORS_FILE = os.path.join(
    WORKING_DIR, "static", "localApi", "ghContributors.json"
)


def update_contributors() -> None:
    response = requests.get(
        "https://api.github.com/repos/Materialious/Materialious/contributors",
        headers={"Accept": "application/vnd.github+json"},
        timeout=30,
    )
    response.raise_for_status()
    contributors = response.json()

    os.makedirs(os.path.dirname(CONTRIBUTORS_FILE), exist_ok=True)
    with open(CONTRIBUTORS_FILE, "w", encoding="utf-8") as f_:
        json.dump(contributors, f_, ensure_ascii=False, separators=(",", ":"))
    print(f"GitHub contributors written to {CONTRIBUTORS_FILE}")


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
        if version_name_match.group(1) == LATEST_VERSION:
            return
        version_code = int(version_code_match.group(1)) + 1
        contents = re.sub(r"versionCode\s+\d+", f"versionCode {version_code}", contents)
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

    new_release = f"""    <release version="{LATEST_VERSION}" date="{RELEASE_DATE}">
      <url>https://github.com/Materialious/Materialious/releases/tag/{LATEST_VERSION}</url>
    </release>"""

    # Insert the new release right after the opening <releases> tag,
    # collapsing any stray whitespace so no blank lines accumulate
    updated_contents = re.sub(
        r"(?P<tag><releases>)\s*",
        rf"\g<tag>\n{new_release}\n",
        contents,
        count=1,
    )

    with open(METAINFO_FILE, "w") as f_:
        f_.write(updated_contents)


if __name__ == "__main__":
    update_contributors()

    for location in (ROOT_PACKAGE, SHARED_PACKAGE, ELECTRON_PACKAGE):
        package_json_update_ver(location)

    update_android_version()
    update_metainfo_release()
