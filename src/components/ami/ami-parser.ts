import { Service } from "typedi";
import { LinearBuffer } from "./buffers/linear-buffer";

const MessageSeparatorChars = Buffer.from(`\r\n\r\n`);
const LineSeparatorChars = Buffer.from(`\r\n`)
const KeyValueSplitChars = Buffer.from(`:`)
const SpaceChar = Buffer.from(` `)
const maxBufferSize = 1_048_576 // bytes

export interface MessageReader {
    getColumnIndex(): AmiMessageColumnIndex
    getKeyCount(): number;
    getKey(pos: number): Buffer;
    getValue(pos: number): Buffer;
}

export interface AmiParserListener {
    onMessageParsed(reader: MessageReader)
}

export class AmiMessageColumnIndex {
    Uniqueid: number;
    Linkedid: number;
    Event: number;
    BridgeUniqueid: number;
    Context: number;
    Channel: number;
    Exten: number;
    CallerIDNum: number;
    Variable: number;
    Value: number;
    ActionID: number;
    Response: number;
}

@Service({ transient : true })
export class AmiParser implements MessageReader {

    private buffer: LinearBuffer = new LinearBuffer(maxBufferSize)

    // predefined array of keys, each key buffer is 256 byte long
    private readonly keys: Buffer[];
    // the size of single key buffer if written in keyLength by its position
    private readonly keyLength: number[];
    // total number of keys written in keys
    private keyCount: number = 0

    // predefined array of values, each value is buffer 256 bytes long
    private readonly values: Buffer[];
    // filled length of each value buffer
    private readonly valueLength: number[];

    private listener: AmiParserListener
    private columnIndex: AmiMessageColumnIndex = new AmiMessageColumnIndex()

    private byteCount: number = 0
    private messageCount: number = 0

    constructor() {

        this.keys = []
        this.values = []
        this.keyLength = []
        this.valueLength = []

        let i = 0
        while (i < 100) {
            this.keys.push(Buffer.alloc(256))
            this.keyLength.push(0)
            this.values.push(Buffer.alloc(256))
            this.valueLength.push(0)
            i++
        }
    }

    setListener(listener: AmiParserListener) {
        this.listener = listener
    }

    append(chunk: Buffer, errorCallback: Function) {

        if ( this.buffer.append(chunk) == -1 ){
            errorCallback(new Error(`appending: remaining capacity exceeded`))
            return
        }

        this.byteCount += chunk.length

        let index;
        do {
            index = this.buffer.indexOf(MessageSeparatorChars);
            if (index > -1) {
                const count = index + MessageSeparatorChars.length
                const chunk = this.buffer.read(count)
                if (chunk) {
                    // remove ending message separator chars
                    const data = chunk.subarray(0, index)
                    this.buildMessage(data)
                    if (this.listener) {
                        this.listener.onMessageParsed(this)
                    }
                    this.messageCount++
                } else {
                    errorCallback(new Error(`trying to read more bytes than written: `
                        + `count=${count}, length=${this.buffer.length()}, dump=${this.buffer.toString()}`))
                    break
                }
            }
        } while (index > -1);

        this.buffer.compact();
    }

    /**
     *
     * @param data complete data buffer of one single message
     */
    private buildMessage(data: Buffer) {

        let offset = 0
        let index = -1
        this.keyCount = 0
        this.columnIndex.Uniqueid = null
        this.columnIndex.Linkedid = null
        this.columnIndex.Event = null
        this.columnIndex.BridgeUniqueid = null
        this.columnIndex.Context = null
        this.columnIndex.Channel = null
        this.columnIndex.Exten = null
        this.columnIndex.CallerIDNum = null
        this.columnIndex.Variable = null
        this.columnIndex.Value = null
        this.columnIndex.ActionID = null
        this.columnIndex.Response = null

        do {

            index = data.indexOf(LineSeparatorChars, offset)
            if (index > -1) {
                // valid for first of all lines except last
                // line should be slice to avoid extra memory allocation
                let line = data.slice(offset, index)
                let pos = line.indexOf(KeyValueSplitChars)
                if ( pos > -1 ){
                    // line has key-value spitter
                    this.addKeyValue(line, pos)
                }
                // offset right to next line block
                offset = offset + line.length + LineSeparatorChars.length
            }
            else if ( offset > 0 ) {
                // valid for last line in message
                // line should be slice to avoid extra memory allocation
                // from offset to the end of the message buffer
                let line = data.slice(offset)
                let pos = line.indexOf(KeyValueSplitChars)
                if ( pos > -1 ) {
                    // line has key-value splitter
                    this.addKeyValue(line, pos)
                }
            }

        } while (index > -1)
    }

    private addKeyValue(line: Buffer, splitterPosition: number) {

        let i = this.keyCount

        let key = line.slice(0, splitterPosition)
        key.copy(this.keys[i], 0, 0)
        this.keyLength[i] = splitterPosition
        this.keyCount = this.keyCount + 1

        let value = line.slice(splitterPosition + KeyValueSplitChars.length)
        let sourceStart = 0;
        if ( value.indexOf(SpaceChar) == 0 ){
            sourceStart = sourceStart + 1
        }
        value.copy(this.values[i], 0, sourceStart)
        this.valueLength[i] = line.length - splitterPosition - KeyValueSplitChars.length - sourceStart

        switch (key.toString()) {
            case "Uniqueid":
                this.columnIndex.Uniqueid = i
                break
            case "Linkedid":
                this.columnIndex.Linkedid = i
                break
            case "Event":
                this.columnIndex.Event = i
                break
            case "BridgeUniqueid":
                this.columnIndex.BridgeUniqueid = i
                break
            case "Context":
                this.columnIndex.Context = i
                break
            case "Channel":
                this.columnIndex.Channel = i
                break
            case "Exten":
                this.columnIndex.Exten = i
                break
            case "CallerIDNum":
                this.columnIndex.CallerIDNum = i
                break
            case "Variable":
                this.columnIndex.Variable = i
                break
            case "Value":
                this.columnIndex.Value = i
                break
            case "ActionID":
                this.columnIndex.ActionID = i
                break
            case "Response":
                this.columnIndex.Response = i
                break
        }
    }

    reset() {
        this.buffer.reset()
        this.keyCount = 0
    }

    getKeyCount(): number {
        return this.keyCount
    }

    getKey(pos: number): Buffer {
        return this.keys[pos].slice(0, this.keyLength[pos])
    }

    getValue(pos: number): Buffer {
        return this.values[pos].slice(0, this.valueLength[pos])
    }

    getColumnIndex(): AmiMessageColumnIndex {
        return this.columnIndex;
    }

    getByteCount(){
        return this.byteCount
    }

    getMessageCount() {
        return this.messageCount
    }

    resetMessageCount() {
        this.messageCount = 0
    }
}
