# Dependency patches

`npm install` and `npm ci` apply these patches through `postinstall` using
`patch-package --error-on-fail`.

## @capawesome/capacitor-nodejs 0.2.0

Normalize native source paths and omit the linker-generated Build ID so the
Android JNI library is byte-identical across checkout directories.

## googlevideo 5.0.1

A SABR response can contain initialization data followed by multiple media
segments in a single fetch chunk. `SabrUmpProcessor` previously kept processing
after finding a terminal result, allowing later segments to replace the requested
index and overwrite its initialization cache. Companion's buffered responses
exposed this as Shaka error 3004.

Review this patch when upgrading googlevideo. Installation fails if it cannot
be applied, rather than silently shipping the broken decoder.
