import { AmiConfig } from "../components/ami/ami-config";
import { StorageConfig } from "../components/storage/storage-config";
import { Dictionary } from "../components/shared/dictionary";

export interface ConfigFile {
    asterisk: Dictionary<AmiConfig>
    storage: Dictionary<StorageConfig>
}