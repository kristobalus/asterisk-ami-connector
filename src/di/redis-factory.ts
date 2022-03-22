import { Factory } from "./factory";
import * as IORedis from "ioredis";
import { Dictionary } from "../components/shared/dictionary";


// noinspection JSMethodCanBeStatic
export class RedisFactory  {

    private connectionMap: Map<string, IORedis.Redis> = new Map<string, IORedis.Redis>()

    constructor(
        private config: Dictionary<IORedis.RedisOptions>
    ) {}

    private build(config: IORedis.RedisOptions) {
        return new IORedis(config);
    }

    create(className: string, connectionFlavor: string = "default"): IORedis.Redis {

        if (!className)
            throw new Error(`Argument className is not defined`)

        const connectionTag = className + ":" + connectionFlavor

        if ( this.connectionMap.get(connectionTag) == null ){
            const classConfig = this.config[className]
            if ( !classConfig )
                throw new Error(`Redis configuration not defined for className: ${className}`)
            const connection = this.build(classConfig)
            this.connectionMap.set(connectionTag, connection)
        }

        return this.connectionMap.get(connectionTag)
    }

}