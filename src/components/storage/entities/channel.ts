import { TelephonyExternalCallRegister, TypeOfCall } from "../../bitrix-api/models/api/telephony-external-call-register";
import { RequestStages } from "../../call-logic/request-stages";

type DialStatusValue = "CHANUNAVAIL" | "CONGESTION" | "BUSY" | "NOANSWER" | "ANSWER" | "CANCEL" | "DONTCALL" | "TORTURE"



export class Channel {

    /** hangup cause */
    Cause?: string;
    CallerIDNum?: string;
    // уникальный идентификатор канала в системе Астериска
    Uniqueid?: string;
    // идентификатор главного канала, сам главный канал имеет отдинаковые значения Linkedid и Uniqueid
    Linkedid?: string;
    CallerIDName?: string;
    ConnectedLineNum?: string;
    ConnectedLineName?: string;
    Context?: string;
    Exten?: string;
    Priority?: string;
    Channel?: string;
    ChannelState?: string;
    ChannelStateDesc?: string;
    Language?: string;
    AccountCode?: string;
    Variable?: string; // from VarSet
    Value?: string; // from VarSet
    StartTime?: string; // cdr_manager
    AnswerTime?: string;  // cdr_manager
    Endtime?: string; // cdr_manager
    Duration?: string; // cdr_manager
    RingGroupMethod?: string;

    // Context for transferred calls
    TRANSFER_CONTEXT?: string;
    // Context for forwarded calls
    FORWARD_CONTEXT?: string;
    ANSWEREDTIME?: string;
    DIALEDTIME?: string;
    DIALEDPEERNAME?: string;
    DIALSTATUS?: DialStatusValue;
    MIXMONITOR_FILENAME?: string;
    __CALLFILENAME?: string;
    __FROM_DID?: string;
    __FROMEXTEN?: string;
    __DTMF?: string;

    /** passed via Action: Originate from B24
     to avoid creating the lead for the call in B24 */
    __NOLEAD?: string;

    /**
     * TelephonyExternalCallRegister
     * passed via Action: Originate from B24
     * CRM object ID, type of which is specified in CRM_ENTITY_TYPE
     */
    __CRM_ENTITY_ID?: string;

    /**
     * TelephonyExternalCallRegister
     * passed via Action: Originate from B24
     * Type of CRM object, from the details card of which the call is made - CONTACT | COMPANY | LEAD.
     */
    __CRM_ENTITY_TYPE?: string;
    __CRM_CREATED_LEAD?: string;

    /**
     * TelephonyExternalCallRegister
     * STATUS_ID of the source from the source selection list.
     * You can receive a list of sources by the crm.status.list method with filter by "ENTITY_ID": "SOURCE".
     */
    __CRM_SOURCE?: string;

    /**
     * TelephonyExternalCallRegister
     * возможные значения
     *  undefined
     *  "NA"
     */
    __CRM_USER_ID?: string;

    /**
     * возможные значения
     *  undefined
     *  "NA"
     */
    __CRM_USER_PHONE_INNER?: string;

    /**
     * TelephonyExternalCallRegister
     * Call dialing list ID, to which the call should be connected.
     */
    __CALL_LIST_ID?: number;

    /** passed via Action: Originate from B24  */
    __CALL_ID?: string;

    /** webhook */
    __WEBHOOK?: string;

    /** оценка разговора */
    __OcenkaOper?: string;

    // флаг показывает что канал является или когда-то был залинкован другими каналами
    // и является "родительским" или "рутовым" каналом
    // даже после перехвата звонка, когда канал получает Linkedid
    // то флаг isLinkedChannel в Redis остается равным "true" и показывает что этот канал был "главным"
    // все остальные каналы такого флага иметь не будут
    isLinkedChannel?: boolean;
    isShowCardRequested?: boolean;
    isHideCardRequested?: boolean;
    isRegisterRequested?: boolean;
    isFinishRequested?: boolean;
    isFinishCompleted?: boolean;
    isAttachRequested?: boolean;
    isAttachCompleted?: boolean;
    asteriskFilename?: string;
    bitrixCallId?: string;
    isCrmUserRequested?: boolean;
    statusCode?: string;
    responsibleUserPhone: string;
    responsibleUserId: string;

    bitrixAttachRequestStage: RequestStages
}

