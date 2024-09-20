"""Script for removing unwanted Capacitor plugins
"""

import json
import os

WORKING_DIR = os.path.dirname(os.path.realpath(__file__))

ELECTRON_PLUGIN_FILE = os.path.join(WORKING_DIR, "src", "rt", "electron-plugins.js")
PACKAGE_JSON = os.path.join(WORKING_DIR, "package.json")


ELECTRON_PLUGIN_REPLACEMENT = """/* eslint-disable @typescript-eslint/no-var-requires */

module.exports = {
}"""


def run():
    with open(ELECTRON_PLUGIN_FILE, "w") as f_:
        f_.write(ELECTRON_PLUGIN_REPLACEMENT)

    with open(PACKAGE_JSON, "r") as f_:
        package: dict = json.loads(f_.read())
        if "dependencies" not in package:
            return

        package["dependencies"].pop("capacitor-nodejs")

        f_.close()

        with open(PACKAGE_JSON, "w") as f_:
            f_.write(json.dumps(package, indent="\t"))


if __name__ == "__main__":
    run()
