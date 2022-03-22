

export class QueueDto {
    className: string;
    jsonSerializedData: string;
    responseStream: string;
    // assigned in receiver
    id: string;
    // assigned in receiver
    streamName: string;
    // assigned in receiver
    groupName: string;
}