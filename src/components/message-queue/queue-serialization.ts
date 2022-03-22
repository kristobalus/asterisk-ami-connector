import { QueueDto } from "./queue-dto";
import { AmiOriginateRequest } from "./requests/ami-originate-request";


export function deserializeQueueDto(dto: QueueDto)  {

    if ( dto.className === AmiOriginateRequest.name ) {
        const request = new AmiOriginateRequest()
        Object.assign(request, JSON.parse(dto.jsonSerializedData))
        return request
    }

    throw new Error("Unknown serialization")
}