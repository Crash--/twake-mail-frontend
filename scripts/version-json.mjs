// Prints the /version.json of the Docker image (see apps/private/Dockerfile):
// the build and the release notes of release-notes/.
//
// Usage: node scripts/version-json.mjs <build> <release-notes dir>
import { versionJson } from './lib/versionJson.mjs'

const [build, dir] = process.argv.slice(2)
if (!build || !dir) {
  console.error(
    'Usage: node scripts/version-json.mjs <build> <release-notes dir>'
  )
  process.exit(1)
}

console.log(versionJson(build, dir))
