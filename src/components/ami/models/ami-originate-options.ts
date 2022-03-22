import { Dictionary } from "../../shared/dictionary";


export enum AmiOriginateVariables  {
    __NOLEAD = "__NOLEAD",
    __DTMF =  "__DTMF",
    __CRM_USER_ID = "__CRM_USER_ID",
    __CALL_ID = "__CALL_ID",
    __CRM_ENTITY_ID = "__CRM_ENTITY_ID",
    __CRM_ENTITY_TYPE = "__CRM_ENTITY_TYPE",
    __CRM_USER_PHONE_INNER = "__CRM_USER_PHONE_INNER",
    __WEBHOOK = "__WEBHOOK"
}

export class AmiOriginateOptions {

    channel: string;
    context: string;
    priority: string;
    exten: string;
    earlyMedia: boolean;
    async: boolean;
    callerId: string;
    application: string;
    data: string;
    variables: Dictionary<string> = {};


}