import path from "node:path";
import { buildRoomLightingAssets } from "./room-lighting-assets";

const rootDir = path.resolve(__dirname, "../../..");
buildRoomLightingAssets(rootDir).then((report) => console.log(`Prepared ${report.records.length} room lighting fields.`)).catch((error) => { console.error(error); process.exitCode = 1; });
